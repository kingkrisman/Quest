import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { dayKey, deckMastery, dueItems, levelInfo, streakInfo, useStore } from "../lib/store";
import { useAuth } from "../contexts/AuthContext";
import { Button, Meter } from "../components/ui";
import { DeckCard } from "../components/DeckCard";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { feedback } from "../lib/feedback";
import { list } from "../lib/motion";
import { cn, formatMs, greeting, timeAgo } from "../lib/utils";

const ANSWER_GOAL = 20;
const MODE_LABEL: Record<string, string> = { cards: "Flashcards", learn: "Learn", test: "Test", exam: "Exam", match: "Match", review: "Review", focus: "Focus" };

function PinInput({ onSubmit, loading }: { onSubmit: (pin: string) => void; loading: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pin = digits.join("");

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split("");
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) onSubmit(pin);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div
        className="flex gap-1.5"
        onPaste={(e) => {
          e.preventDefault();
          setAt(0, e.clipboardData.getData("text"));
        }}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            aria-label={`PIN digit ${i + 1}`}
            maxLength={6}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
            className={cn("field w-0 flex-1 h-12 text-center font-serif text-[1.6rem]", i === 2 && "mr-2")}
          />
        ))}
      </div>
      <Button type="submit" variant="tinted" disabled={pin.length !== 6} loading={loading} className="w-full">
        Join game
      </Button>
    </form>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useStore();
  const [joining, setJoining] = useState(false);

  const today = state.activity[dayKey()] ?? { xp: 0, answered: 0, correct: 0, focusMinutes: 0 };
  const streak = streakInfo(state.activity);
  const lvl = levelInfo(state.xp);
  const due = useMemo(() => dueItems(state).length, [state]);
  const goal = state.settings.dailyGoal;
  const recent = useMemo(() => [...state.decks].sort((a, b) => (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt)).slice(0, 4), [state.decks]);
  const continueDeck = state.decks.filter((d) => d.lastStudiedAt).sort((a, b) => b.lastStudiedAt! - a.lastStudiedAt!)[0];
  const firstName = user.name.split(" ")[0];
  const toGoal = Math.max(0, goal - today.xp);

  const joinGame = async (pin: string) => {
    setJoining(true);
    try {
      const { data, error } = await supabase.from("sessions").select("id").eq("pin", pin).eq("status", "lobby").maybeSingle();
      if (error) throw error;
      if (!data) {
        feedback("wrong");
        toast.error("No game with that PIN", { description: "Check the code, or the game may have started." });
        return;
      }
      navigate(`/lobby/${data.id}`);
    } catch {
      toast.error("Couldn't reach the game server", { description: "Check your connection and try again." });
    } finally {
      setJoining(false);
    }
  };

  // The day, read back as a sentence.
  const lede = (
    <>
      {due > 0 ? (
        <>
          You have <b>{due} {due === 1 ? "card" : "cards"}</b> ready for review{toGoal > 0 ? ", " : "."}
        </>
      ) : continueDeck ? (
        <>
          Pick up <b>{continueDeck.title}</b> where you left off{toGoal > 0 ? ", " : "."}
        </>
      ) : (
        <>Open a deck below or scan your own notes to begin{toGoal > 0 ? ", " : "."}</>
      )}
      {toGoal > 0 ? (
        <>
          and you're <b>{toGoal} XP</b> from today's goal.
        </>
      ) : (
        <> Today's goal is done.</>
      )}{" "}
      {streak.current > 0 ? (
        streak.activeToday ? (
          <>
            Your streak stands at <b>{streak.current} {streak.current === 1 ? "day" : "days"}</b>.
          </>
        ) : (
          <>
            Study today to keep your <b>{streak.current}-day streak</b>.
          </>
        )
      ) : null}
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-16">
      <motion.div variants={list.container} initial="hidden" animate="show">
        {/* Lead story */}
        <motion.section variants={list.item} className="grid lg:grid-cols-12 gap-x-10 gap-y-8">
          <div className="lg:col-span-7">
            <h1 className="t-display text-ink">
              {greeting()},<br />
              <em className="italic">{firstName}.</em>
            </h1>
            <p className="t-body text-[1.0625rem] text-ink-2 mt-5 max-w-[52ch] [&_b]:text-ink [&_b]:font-semibold">{lede}</p>
            <div className="flex flex-wrap gap-2.5 mt-7">
              {due > 0 ? (
                <Button size="lg" color="accent" icon={I.review} onClick={() => navigate("/review")}>
                  Review {due} {due === 1 ? "card" : "cards"}
                </Button>
              ) : continueDeck ? (
                <Button size="lg" color="accent" icon={I.play} onClick={() => navigate(`/deck/${continueDeck.id}`)}>
                  Continue {continueDeck.title.length > 22 ? "studying" : continueDeck.title}
                </Button>
              ) : (
                <Button size="lg" color="accent" icon={I.scan} onClick={() => navigate("/import")}>
                  Scan your notes
                </Button>
              )}
              <Button size="lg" variant="tinted" icon={I.scan} onClick={() => navigate("/import")} className={cn(!continueDeck && due === 0 && "hidden")}>
                Scan notes
              </Button>
            </div>
          </div>

          {/* Today's ledger */}
          <aside className="lg:col-span-5 lg:border-l lg:border-line lg:pl-10" aria-label="Today's goals">
            <h2 className="t-title2 text-ink">Today's goals</h2>
            <div className="mt-5 space-y-5">
              <Meter label="Study" value={today.xp} max={goal} unit="XP" color="var(--c-accent)" done={today.xp >= goal} />
              <Meter label="Questions answered" value={today.answered} max={ANSWER_GOAL} done={today.answered >= ANSWER_GOAL} />
              <Meter label="Focus" value={today.focusMinutes} max={state.settings.focusMinutes} unit="min" done={today.focusMinutes >= state.settings.focusMinutes} />
            </div>
            <p className="t-footnote text-ink-2 mt-5">
              Level <span className="t-num text-ink">{lvl.level}</span> · {state.xp.toLocaleString()} XP · {lvl.span - lvl.into} XP to level {lvl.level + 1}
            </p>
          </aside>
        </motion.section>

        <div className="rule-double mt-12" />

        {/* Decks */}
        <motion.section variants={list.item} className="mt-8">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="t-title1 text-ink">Continue studying</h2>
            <Link to="/library" className="t-subhead text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
              All decks
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((deck) => (
              <DeckCard key={deck.id} deck={deck} mastery={deckMastery(deck, state.cards).percent} meta={`${deck.items.length} items · ${deck.lastStudiedAt ? `studied ${timeAgo(deck.lastStudiedAt)}` : "not started"}`} />
            ))}
          </div>
        </motion.section>

        {/* Columns */}
        <motion.section variants={list.item} className="grid md:grid-cols-12 gap-x-10 gap-y-10 mt-14 pt-8 border-t-[1.5px] border-rule">
          <div className="md:col-span-7">
            <h2 className="t-title2 text-ink">Recent sessions</h2>
            {state.sessions.length === 0 ? (
              <p className="t-body text-ink-2 mt-3">Your study log will appear here after your first session.</p>
            ) : (
              <ul className="mt-3">
                {state.sessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-baseline gap-4 py-3 border-b border-line">
                    <span className="t-footnote text-ink-2 w-20 shrink-0">{MODE_LABEL[s.mode] ?? s.mode}</span>
                    <span className="flex-1 min-w-0 truncate t-subhead text-ink">{s.mode === "focus" ? `${Math.round(s.durationMs / 60000)} minutes of focus` : s.deckTitle}</span>
                    {s.total > 0 && <span className="t-subhead t-num text-ink">{Math.round((s.correct / s.total) * 100)}%</span>}
                    <span className="t-footnote text-ink-2 w-16 text-right shrink-0">{timeAgo(s.at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {state.sessions.length > 0 && (
              <p className="t-footnote text-ink-2 mt-3">
                {formatMs(state.sessions.reduce((a, s) => a + s.durationMs, 0))} studied in {state.sessions.length} {state.sessions.length === 1 ? "session" : "sessions"}.{" "}
                <Link to="/stats" className="text-ink underline underline-offset-4 decoration-line hover:decoration-ink">
                  See progress
                </Link>
              </p>
            )}
          </div>
          <div className="md:col-span-5 md:border-l md:border-line md:pl-10">
            <h2 className="t-title2 text-ink">Join a live game</h2>
            <p className="t-subhead text-ink-2 mt-1 mb-4">Enter the six-digit PIN your host shares.</p>
            <PinInput onSubmit={joinGame} loading={joining} />
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
