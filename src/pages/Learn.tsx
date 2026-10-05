import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { actions, useStore, type Deck, type Item } from "../lib/store";
import { choicesFor } from "../lib/deck";
import { isClose } from "../lib/answer";
import { StudyHeader, SessionSummary } from "../components/StudyShell";
import { Button, EmptyState } from "../components/ui";
import { I } from "../components/icons";
import { celebrate, feedback } from "../lib/feedback";
import { easeOut, spring, springBouncy, springFast } from "../lib/motion";
import { cn, shuffle } from "../lib/utils";

type Round = { item: Item; kind: "choice"; options: string[]; correctIndex: number } | { item: Item; kind: "written" };

interface Result {
  item: Item;
  correct: boolean;
  given: string;
}

const TEST_SECONDS = 20;
const PRAISE = ["Correct", "Nice", "Exactly", "Well done", "Spot on"];

const choiceRound = (item: Item, deck: Deck): Round => ({ item, kind: "choice", ...choicesFor(item, deck) });

/** Only this tiny component re-renders every second, not the whole question. */
function SecondsLeft({ startedAt, running }: { startedAt: number; running: boolean }) {
  const [left, setLeft] = useState(TEST_SECONDS);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const l = Math.max(0, Math.ceil(TEST_SECONDS - (Date.now() - startedAt) / 1000));
      setLeft(l);
      if (l <= 5 && l > 0) feedback("tick");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt, running]);
  return <span className={cn("t-subhead font-semibold tabular-nums w-7 text-right", left <= 5 ? "text-red" : "text-ink-2")}>{left}</span>;
}

export function Learn({ timed = false }: { timed?: boolean }) {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { decks } = useStore();
  const deck = decks.find((d) => d.id === deckId);

  const initial = useMemo(() => (deck ? shuffle(deck.items).map((it) => choiceRound(it, deck)) : []), [deck?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rounds, setRounds] = useState<Round[]>(initial);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [written, setWritten] = useState("");
  const [verdict, setVerdict] = useState<null | { correct: boolean; given: string }>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [xp, setXp] = useState(0);
  const [lastXp, setLastXp] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [done, setDone] = useState(false);
  const logged = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const round = rounds[index];
  const mastered = new Set(results.filter((r) => r.correct).map((r) => r.item.id)).size;
  const goal = deck?.items.length ?? 1;

  const submit = useCallback(
    (given: string, correct: boolean, choiceIndex: number | null) => {
      if (!round || verdict) return;
      setPicked(choiceIndex);
      setVerdict({ correct, given });
      const nextCombo = correct ? combo + 1 : 0;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));

      // Speed bonus in Test, combo bonus in Learn.
      const speedBonus = timed && correct ? Math.round((Math.max(0, TEST_SECONDS * 1000 - (Date.now() - questionStart)) / (TEST_SECONDS * 1000)) * 10) : 0;
      const comboBonus = !timed && correct && nextCombo >= 3 ? Math.min(10, nextCombo) : 0;
      const earned = actions.answer(round.item.id, correct ? (round.kind === "written" ? 4 : 3) : 1, { bonus: speedBonus + comboBonus });
      setXp((x) => x + earned);
      setLastXp(earned);
      setResults((r) => [...r, { item: round.item, correct, given }]);
      feedback(correct ? (nextCombo > 0 && nextCombo % 5 === 0 ? "combo" : "correct") : "wrong");

      if (!timed && deck) {
        setRounds((rs) => {
          const next = [...rs];
          if (!correct) next.splice(Math.min(index + 3, next.length), 0, choiceRound(round.item, deck));
          else if (round.kind === "choice" && !round.item.options && deck.items.length >= 2 && !rs.slice(index + 1).some((r) => r.item.id === round.item.id)) next.push({ item: round.item, kind: "written" });
          return next;
        });
      }
    },
    [round, verdict, combo, timed, questionStart, deck, index]
  );

  const advance = useCallback(() => {
    if (!verdict) return;
    setVerdict(null);
    setPicked(null);
    setWritten("");
    if (index + 1 >= rounds.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setQuestionStart(Date.now());
  }, [verdict, index, rounds.length]);

  // Correct answers auto-advance to keep momentum; wrong ones wait so you can read the fix.
  useEffect(() => {
    if (!verdict?.correct) return;
    const t = setTimeout(advance, timed ? 700 : 1000);
    return () => clearTimeout(t);
  }, [verdict, advance, timed]);

  // Test mode: one timeout per question instead of a render loop.
  useEffect(() => {
    if (!timed || verdict || done || !round) return;
    const t = setTimeout(() => submit("", false, null), TEST_SECONDS * 1000 - (Date.now() - questionStart));
    return () => clearTimeout(t);
  }, [timed, verdict, done, round, questionStart, submit]);

  useEffect(() => {
    if (round?.kind === "written" && !verdict) inputRef.current?.focus();
  }, [round, verdict]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !round) return;
      if (verdict && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        advance();
      } else if (!verdict && round.kind === "choice") {
        const n = Number(e.key);
        if (n >= 1 && n <= round.options.length) submit(round.options[n - 1], n - 1 === round.correctIndex, n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, round, verdict, advance, submit]);

  useEffect(() => {
    if (!done || logged.current || !deck || results.length === 0) return;
    logged.current = true;
    const firstTry = new Map<string, boolean>();
    results.forEach((r) => !firstTry.has(r.item.id) && firstTry.set(r.item.id, r.correct));
    const correct = [...firstTry.values()].filter(Boolean).length;
    actions.logSession({ deckId: deck.id, deckTitle: deck.title, mode: timed ? "test" : "learn", correct, total: firstTry.size, durationMs: Date.now() - startedAt, xp });
    feedback("complete");
    if (correct / firstTry.size >= 0.8) celebrate();
  }, [done, deck, results, timed, startedAt, xp]);

  const restart = () => {
    if (!deck) return;
    setRounds(shuffle(deck.items).map((it) => choiceRound(it, deck)));
    setIndex(0);
    setPicked(null);
    setWritten("");
    setVerdict(null);
    setCombo(0);
    setBestCombo(0);
    setResults([]);
    setXp(0);
    setStartedAt(Date.now());
    setQuestionStart(Date.now());
    setDone(false);
    logged.current = false;
  };

  if (!deck || deck.items.length === 0) {
    return <EmptyState icon={I.review} title="Nothing to practice" body="This deck doesn't exist or has no items." action={<Button onClick={() => navigate("/library")}>Back to Library</Button>} />;
  }

  if (done) {
    const firstTry = new Map<string, Result>();
    results.forEach((r) => !firstTry.has(r.item.id) && firstTry.set(r.item.id, r));
    const missed = [...firstTry.values()].filter((r) => !r.correct);
    return (
      <SessionSummary
        title={`${deck.title} · ${timed ? "Test" : "Learn"}`}
        correct={firstTry.size - missed.length}
        total={firstTry.size}
        xp={xp}
        durationMs={Date.now() - startedAt}
        onAgain={restart}
        onDone={() => navigate(`/deck/${deck.id}`)}
        againLabel={timed ? "Retake" : "Learn Again"}
        extra={
          <div className="mt-6 text-left space-y-6">
            {bestCombo >= 3 && (
              <div className="grouped">
                <div className="flex items-center gap-3 px-4 h-12">
                  <I.fire className="w-5 h-5 text-orange" />
                  <span className="t-body text-ink flex-1">Best streak</span>
                  <span className="t-headline text-ink tabular-nums">{bestCombo} in a row</span>
                </div>
              </div>
            )}
            {missed.length > 0 && (
              <section>
                <h3 className="t-footnote font-medium text-ink-2 px-4 mb-1.5">Review these</h3>
                <div className="grouped">
                  {missed.map((r) => (
                    <div key={r.item.id} className="px-4 py-3">
                      <p className="t-subhead font-semibold text-ink">{r.item.prompt}</p>
                      <p className="t-subhead text-green mt-0.5">{r.item.answer}</p>
                      {r.given && <p className="t-footnote text-red line-through">{r.given}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <StudyHeader
        progress={timed ? index / rounds.length : mastered / goal}
        label={timed ? `${index + 1}/${rounds.length}` : `${mastered}/${goal}`}
        exitTo={`/deck/${deck.id}`}
        right={
          <AnimatePresence>
            {combo >= 2 && (
              <motion.span key="combo" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={springFast} className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-orange/15 text-orange t-footnote font-bold">
                <I.fire className="w-4 h-4" />
                <motion.span key={combo} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={springBouncy} className="tabular-nums">
                  {combo}
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
        }
      />

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-4 pb-10 flex flex-col">
        {timed && (
          <div className="flex items-center gap-2.5 mb-6">
            <I.focus className="w-4 h-4 text-ink-2" />
            <div className="flex-1 h-1 rounded-full bg-fill overflow-hidden">
              {/* Keyed per question so the compositor restarts the countdown */}
              <div
                key={`${index}-${questionStart}`}
                className="h-full w-full rounded-full bg-ink-2 origin-left"
                style={{ animation: `countdown ${TEST_SECONDS}s linear forwards`, animationPlayState: verdict ? "paused" : "running" }}
              />
            </div>
            <SecondsLeft startedAt={questionStart} running={!verdict} />
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${round.item.id}-${index}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16, transition: { duration: 0.14 } }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="flex-1 flex flex-col"
          >
            <h1 className="t-title1 text-ink">{round.item.prompt}</h1>
            <p className="t-subhead text-ink-2 mt-2">
              {round.kind === "written" ? "Type the answer. Small typos are fine." : round.item.options ? "Choose the answer" : "Choose the matching definition"}
              {round.kind === "choice" && <span className="hidden sm:inline text-ink-3"> · press 1 to {round.options.length}</span>}
            </p>

            {round.kind === "choice" ? (
              <div className="grid sm:grid-cols-2 gap-2.5 mt-7">
                {round.options.map((opt, i) => {
                  const isAnswer = i === round.correctIndex;
                  const isPicked = i === picked;
                  const state = !verdict ? "idle" : isAnswer ? "correct" : isPicked ? "wrong" : "dim";
                  return (
                    <button
                      key={i}
                      disabled={!!verdict}
                      onClick={() => submit(opt, isAnswer, i)}
                      className={cn(
                        "press relative text-left flex items-center gap-3.5 p-4 rounded-[4px] min-h-16 transition-[background-color,opacity,box-shadow] duration-200",
                        state === "idle" && "bg-surface shadow-[inset_0_0_0_1px_var(--c-line)] hover:shadow-[inset_0_0_0_1.5px_var(--c-ink)]",
                        state === "correct" && "bg-surface shadow-[inset_0_0_0_2px_var(--sys-green)]",
                        state === "wrong" && "bg-surface shadow-[inset_0_0_0_2px_var(--c-accent)] animate-shake",
                        state === "dim" && "bg-surface shadow-[inset_0_0_0_1px_var(--c-line)] opacity-45"
                      )}
                    >
                      <span
                        className={cn(
                          "w-8 h-8 shrink-0 rounded-full grid place-items-center font-serif text-[1.15rem] transition-colors",
                          state === "correct" ? "bg-green text-white" : state === "wrong" ? "bg-accent text-on-accent" : "shadow-[inset_0_0_0_1.5px_var(--c-ink-3)] text-ink-2 group-hover:text-ink"
                        )}
                      >
                        {state === "correct" ? <I.check className="w-4 h-4" /> : state === "wrong" ? <I.x className="w-4 h-4" /> : "ABCDEFGH"[i]}
                      </span>
                      <span className="t-body text-ink">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <WrittenInput
                inputRef={inputRef}
                value={written}
                onChange={setWritten}
                disabled={!!verdict}
                verdict={verdict}
                onSubmit={() => submit(written, isClose(written, round.item.answer), null)}
                onSkip={() => submit("", false, null)}
              />
            )}

            <AnimatePresence>
              {verdict && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={spring}
                  className={cn("mt-5 rounded-[4px] p-4 flex flex-col sm:flex-row sm:items-center gap-3", verdict.correct ? "bg-green/10" : "bg-red/10")}
                >
                  <div className="flex-1 flex gap-3">
                    {verdict.correct ? <I.success className="w-6 h-6 text-green shrink-0" /> : <I.error className="w-6 h-6 text-accent shrink-0" />}
                    <div>
                      <p className={cn("t-headline", verdict.correct ? "text-green" : "text-accent")}>
                        {verdict.correct ? `${PRAISE[index % PRAISE.length]} · +${lastXp} XP` : verdict.given ? "Not quite" : timed ? "Time's up" : "Skipped"}
                      </p>
                      {!verdict.correct && (
                        <p className="t-subhead text-ink mt-0.5">
                          Answer: <span className="font-semibold">{round.item.answer}</span>
                        </p>
                      )}
                      {round.item.explanation && (
                        <p className="t-footnote text-ink-2 mt-1 flex gap-1.5">
                          <I.hint className="w-4 h-4 shrink-0 text-yellow" />
                          {round.item.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                  {!verdict.correct && (
                    <Button onClick={advance} className="shrink-0">
                      Continue
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function WrittenInput({
  inputRef,
  value,
  onChange,
  disabled,
  verdict,
  onSubmit,
  onSkip,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  verdict: { correct: boolean } | null;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit();
  };
  return (
    <form onSubmit={submit} className="mt-7">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Your answer"
        autoComplete="off"
        className={cn(
          "w-full h-14 px-4 rounded-[4px] t-title3 font-medium outline-none transition-shadow placeholder:text-ink-3",
          verdict ? (verdict.correct ? "bg-green/12 shadow-[inset_0_0_0_2px_var(--sys-green)]" : "bg-red/10 shadow-[inset_0_0_0_2px_var(--sys-red)] animate-shake") : "card focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
        )}
      />
      {!disabled && (
        <div className="flex justify-between mt-3">
          <Button type="button" variant="plain" onClick={onSkip}>
            I don't know
          </Button>
          <Button type="submit" disabled={!value.trim()}>
            Check
          </Button>
        </div>
      )}
    </form>
  );
}
