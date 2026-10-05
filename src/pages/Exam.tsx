import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { actions, useStore, type Deck, type Item } from "../lib/store";
import { choicesFor } from "../lib/deck";
import { isClose } from "../lib/answer";
import { Button, Dialog, EmptyState, Group, IconTile, ProgressRing, Row, Stepper } from "../components/ui";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { celebrate, feedback } from "../lib/feedback";
import { easeOut, spring } from "../lib/motion";
import { cn, formatMs, shuffle } from "../lib/utils";

type Question = { item: Item; kind: "choice"; options: string[]; correctIndex: number } | { item: Item; kind: "typed" };
type Answer = { choice?: number; text?: string };

/** Short answers are typed; long ones become multiple choice so the exam stays fair. */
function buildQuestion(item: Item, deck: Deck): Question {
  if (item.options && item.options.length >= 2) return { item, kind: "choice", ...choicesFor(item, deck) };
  if (item.answer.split(/\s+/).length <= 4 || deck.items.length < 3) return { item, kind: "typed" };
  return { item, kind: "choice", ...choicesFor(item, deck) };
}

const isCorrect = (q: Question, a: Answer | undefined) => (q.kind === "choice" ? a?.choice === q.correctIndex : !!a?.text && isClose(a.text, q.item.answer));
const answered = (a: Answer | undefined) => a !== undefined && (a.choice !== undefined || !!a.text?.trim());
const grade = (pct: number) => (pct >= 0.9 ? "A" : pct >= 0.8 ? "B" : pct >= 0.7 ? "C" : pct >= 0.6 ? "D" : "F");

function Clock({ endsAt, onExpire }: { endsAt: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));
  const expired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const l = Math.max(0, endsAt - Date.now());
      setLeft(l);
      if (l <= 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt, onExpire]);
  const low = left < 60_000;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span role="timer" aria-live={low ? "polite" : "off"} className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-full t-subhead t-num", low ? "bg-red/12 text-red" : "bg-fill text-ink")}>
      <I.alarm className="w-4 h-4" aria-hidden />
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function Exam() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { decks } = useStore();
  const deck = decks.find((d) => d.id === deckId);
  const total = deck?.items.length ?? 0;

  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [count, setCount] = useState(Math.min(total, 30));
  const [minutes, setMinutes] = useState(deck?.examMinutes ?? Math.max(5, Math.round(Math.min(total, 30) * 1.2)));
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = (items?: Item[]) => {
    if (!deck) return;
    const pool = items ?? shuffle(deck.items).slice(0, count);
    setQuestions(pool.map((it) => buildQuestion(it, deck)));
    setAnswers({});
    setFlags(new Set());
    setIndex(0);
    const now = Date.now();
    setStartedAt(now);
    setEndsAt(now + minutes * 60_000);
    setPhase("running");
    feedback("tap");
  };

  const submit = useCallback(
    (reason: "user" | "time") => {
      if (phase !== "running" || !deck) return;
      setConfirmSubmit(false);
      const now = Date.now();
      setFinishedAt(now);
      setPhase("done");
      let correct = 0;
      let xp = 0;
      questions.forEach((q, i) => {
        const ok = isCorrect(q, answers[i]);
        if (ok) correct++;
        xp += actions.answer(q.item.id, ok ? 3 : 1, { bonus: ok ? 2 : 0 });
      });
      actions.logSession({ deckId: deck.id, deckTitle: deck.title, mode: "exam", correct, total: questions.length, durationMs: now - startedAt, xp });
      if (reason === "time") toast.info("Time's up", { description: "Your exam was submitted automatically." });
      feedback("complete");
      if (correct / Math.max(1, questions.length) >= 0.8) celebrate();
    },
    [phase, deck, questions, answers, startedAt]
  );

  const onExpire = useCallback(() => submit("time"), [submit]);

  // Warn before closing the tab mid-exam.
  useEffect(() => {
    if (phase !== "running") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const q = questions[index];
  const answeredCount = questions.filter((_, i) => answered(answers[i])).length;

  useEffect(() => {
    if (phase === "running" && q?.kind === "typed") inputRef.current?.focus();
  }, [phase, index, q?.kind]);

  // Keyboard: 1-4 choose, arrows move between questions.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(questions.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (q?.kind === "choice") {
        const n = Number(e.key);
        if (n >= 1 && n <= q.options.length) setAnswers((a) => ({ ...a, [index]: { choice: n - 1 } }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, q, index, questions.length]);

  const results = useMemo(() => questions.map((qq, i) => ({ q: qq, a: answers[i], ok: isCorrect(qq, answers[i]) })), [questions, answers]);

  if (!deck || total === 0) {
    return <EmptyState icon={I.cap} title="Nothing to examine" body="This deck doesn't exist or has no items." action={<Button onClick={() => navigate("/library")}>Back to Library</Button>} />;
  }

  /* -------------------------------- Setup -------------------------------- */
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
        <div className="h-11 flex items-center min-w-0">
          <button type="button" onClick={() => navigate(`/deck/${deck.id}`)} className="btn btn-plain -ml-1 gap-0.5 t-body min-w-0 max-w-full">
            <I.back className="w-6 h-6 shrink-0" aria-hidden /> <span className="truncate">{deck.title}</span>
          </button>
        </div>
        <div className="text-center mt-6">
          <IconTile icon={I.cap} color="indigo" size={72} className="mx-auto" />
          <h1 className="t-large text-ink mt-5">Exam</h1>
          <p className="t-body text-ink-2 mt-2 max-w-sm mx-auto">Answer everything, then submit. You'll see your grade and every correction at the end, not before.</p>
        </div>
        <Group className="mt-8">
          <Row icon={I.checklist} color="blue" title="Questions" trailing={<Stepper label="questions" value={count} min={1} max={total} onChange={setCount} />} />
          <Row icon={I.alarm} color="red" title="Time limit" subtitle={`${minutes} minutes`} trailing={<Stepper label="minutes" value={minutes} min={1} max={180} step={minutes < 10 ? 1 : 5} onChange={setMinutes} />} />
        </Group>
        <Button size="lg" className="w-full mt-8" onClick={() => start()}>
          Start exam
        </Button>
      </div>
    );
  }

  /* -------------------------------- Results -------------------------------- */
  if (phase === "done") {
    const correct = results.filter((r) => r.ok).length;
    const pct = correct / Math.max(1, results.length);
    const missed = results.filter((r) => !r.ok).map((r) => r.q.item);
    const color = pct >= 0.8 ? "var(--sys-green)" : pct >= 0.6 ? "var(--sys-orange)" : "var(--sys-red)";
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <div className="text-center">
          <h1 className="t-large text-ink">{pct >= 0.9 ? "Outstanding" : pct >= 0.7 ? "You passed" : pct >= 0.5 ? "Almost there" : "Keep practicing"}</h1>
          <p className="t-subhead text-ink-2 mt-1.5">{deck.title}</p>
          <div className="flex justify-center mt-8">
            <ProgressRing value={pct} size={176} stroke={16} color={color}>
              <div className="leading-none">
                <div className="t-num text-[56px] text-ink">{grade(pct)}</div>
                <div className="t-footnote text-ink-2 mt-1">{Math.round(pct * 100)}%</div>
              </div>
            </ProgressRing>
          </div>
        </div>
        <div className="grouped mt-8">
          {[
            { icon: I.success, c: "text-green", k: "Correct", v: `${correct} of ${results.length}` },
            { icon: I.clock, c: "text-blue", k: "Time used", v: formatMs(finishedAt - startedAt) },
          ].map((r) => (
            <div key={r.k} className="flex items-center gap-3 px-4 h-12">
              <r.icon className={cn("w-5 h-5", r.c)} aria-hidden />
              <span className="t-body text-ink flex-1">{r.k}</span>
              <span className="t-headline t-num text-ink">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <Button variant="gray" size="lg" onClick={() => navigate(`/deck/${deck.id}`)}>
            Done
          </Button>
          {missed.length ? (
            <Button size="lg" onClick={() => start(missed)}>
              Retake {missed.length} missed
            </Button>
          ) : (
            <Button size="lg" onClick={() => start()}>
              Retake
            </Button>
          )}
        </div>

        <h2 className="t-title2 text-ink mt-12 mb-3 px-1">Review</h2>
        <ol className="space-y-3">
          {results.map(({ q: qq, a, ok }, i) => {
            const given = qq.kind === "choice" ? (a?.choice !== undefined ? qq.options[a.choice] : undefined) : a?.text?.trim();
            return (
              <li key={i} className="card rounded-[4px] p-4">
                <div className="flex gap-3">
                  {ok ? <I.success className="w-5 h-5 text-green shrink-0 mt-0.5" aria-label="Correct" /> : <I.error className="w-5 h-5 text-red shrink-0 mt-0.5" aria-label="Incorrect" />}
                  <div className="min-w-0">
                    <p className="t-subhead font-semibold text-ink">
                      {i + 1}. {qq.item.prompt}
                    </p>
                    {!ok && <p className="t-subhead text-red mt-1">{given ? <>Your answer: {given}</> : "Not answered"}</p>}
                    <p className="t-subhead text-green mt-0.5">Answer: {qq.item.answer}</p>
                    {qq.item.explanation && !ok && <p className="t-footnote text-ink-2 mt-1.5">{qq.item.explanation}</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </motion.div>
    );
  }

  /* -------------------------------- Running -------------------------------- */
  const a = answers[index];
  const isLast = index === questions.length - 1;
  const unanswered = questions.length - answeredCount;

  const Grid = (
    <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-1.5">
      {questions.map((_, i) => {
        const done = answered(answers[i]);
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIndex(i);
              setShowGrid(false);
            }}
            aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flags.has(i) ? ", flagged" : ""}`}
            aria-current={i === index ? "step" : undefined}
            className={cn(
              "relative h-9 rounded-[4px] t-footnote t-num transition-colors",
              done ? "bg-accent/15 text-accent" : "bg-fill text-ink-2 hover:bg-fill-2",
              i === index && "shadow-[inset_0_0_0_2px_var(--c-accent)]"
            )}
          >
            {i + 1}
            {flags.has(i) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange" aria-hidden />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="sticky top-0 z-40 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button type="button" onClick={() => setConfirmLeave(true)} aria-label="Leave exam" className="btn w-8 h-8 bg-fill text-ink-2 hover:bg-fill-2">
            <I.x className="w-4 h-4" aria-hidden />
          </button>
          <span className="t-subhead text-ink-2 t-num">
            {answeredCount} of {questions.length} answered
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Clock endsAt={endsAt} onExpire={onExpire} />
            <button type="button" onClick={() => setShowGrid(true)} className="lg:hidden btn w-8 h-8 bg-fill text-ink-2 hover:bg-fill-2" aria-label="All questions">
              <I.grid className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-fill">
          <div className="h-full bg-accent origin-left transition-transform duration-300 ease-out" style={{ transform: `scaleX(${answeredCount / questions.length})` }} />
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_240px] gap-10">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={index} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }} transition={{ duration: 0.25, ease: easeOut }}>
              <p className="t-subhead text-ink-2 t-num">
                Question {index + 1} of {questions.length}
              </p>
              <h1 className="t-title1 text-ink mt-2">{q.item.prompt}</h1>

              {q.kind === "choice" ? (
                <div role="radiogroup" aria-label="Answers" className="grid gap-2.5 mt-7">
                  {q.options.map((opt, i) => {
                    const chosen = a?.choice === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [index]: { choice: i } }));
                          feedback("tap");
                        }}
                        className={cn(
                          "press text-left flex items-center gap-3.5 p-4 rounded-[4px] min-h-15 transition-[background-color,box-shadow] duration-150",
                          chosen ? "bg-surface shadow-[inset_0_0_0_2px_var(--c-ink)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--c-line)] hover:shadow-[inset_0_0_0_1.5px_var(--c-ink)]"
                        )}
                      >
                        <span className={cn("w-8 h-8 shrink-0 rounded-full grid place-items-center font-serif text-[1.15rem] transition-colors", chosen ? "bg-ink text-on-ink" : "shadow-[inset_0_0_0_1.5px_var(--c-ink-3)] text-ink-2")}>
                          {"ABCDEFGH"[i]}
                        </span>
                        <span className="t-body text-ink">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <label className="block mt-7">
                  <span className="sr-only">Your answer</span>
                  <input
                    ref={inputRef}
                    value={a?.text ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: { text: e.target.value } }))}
                    onKeyDown={(e) => e.key === "Enter" && !isLast && setIndex((i) => i + 1)}
                    placeholder="Type your answer"
                    autoComplete="off"
                    className="field h-14 px-4 t-title3 font-medium"
                  />
                  <span className="block t-footnote text-ink-2 mt-2">Spelling doesn't need to be perfect.</span>
                </label>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-2 mt-10">
            <Button variant="gray" icon={I.back} disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
            <Button
              variant={flags.has(index) ? "tinted" : "plain"}
              color="orange"
              icon={I.flag}
              aria-pressed={flags.has(index)}
              onClick={() =>
                setFlags((f) => {
                  const n = new Set(f);
                  if (n.has(index)) n.delete(index);
                  else n.add(index);
                  return n;
                })
              }
            >
              <span className="hidden sm:inline">{flags.has(index) ? "Flagged" : "Flag for review"}</span>
            </Button>
            {isLast ? (
              <Button onClick={() => (unanswered || flags.size ? setConfirmSubmit(true) : submit("user"))}>Submit</Button>
            ) : (
              <Button onClick={() => setIndex((i) => i + 1)}>
                Next <I.chevron className="w-4 h-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="t-footnote font-medium text-ink-2 mb-2">Questions</p>
            {Grid}
            <Button variant="tinted" className="w-full mt-4" onClick={() => (unanswered || flags.size ? setConfirmSubmit(true) : submit("user"))}>
              Submit exam
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={showGrid} onClose={() => setShowGrid(false)} title="All questions">
        {Grid}
        <Button className="w-full mt-5" onClick={() => (setShowGrid(false), unanswered || flags.size ? setConfirmSubmit(true) : submit("user"))}>
          Submit exam
        </Button>
      </Dialog>

      <Dialog open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Submit your exam?">
        <p className="t-subhead text-ink-2">
          {unanswered > 0 && (
            <>
              {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered and will be marked wrong.{" "}
            </>
          )}
          {flags.size > 0 && (
            <>
              You flagged {flags.size} for review.{" "}
            </>
          )}
          You can't change answers after submitting.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button variant="gray" onClick={() => setConfirmSubmit(false)}>
            Keep working
          </Button>
          <Button onClick={() => submit("user")}>Submit</Button>
        </div>
      </Dialog>

      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave the exam?">
        <p className="t-subhead text-ink-2">Your answers won't be saved and this attempt won't count.</p>
        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button variant="gray" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button color="red" onClick={() => navigate(`/deck/${deck.id}`)}>
            Leave
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
