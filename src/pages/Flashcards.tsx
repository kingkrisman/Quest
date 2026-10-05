import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { actions, dueItems, getState, useStore, type Deck, type Item, type Rating } from "../lib/store";
import { StudyHeader, SessionSummary } from "../components/StudyShell";
import { Button, EmptyState, IconButton, Kbd } from "../components/ui";
import { I, colorVar, type ColorKey } from "../components/icons";
import { celebrate, feedback } from "../lib/feedback";
import { spring, springBouncy, springFast } from "../lib/motion";
import { shuffle } from "../lib/utils";

interface QueueEntry {
  deck: Deck;
  item: Item;
}

const RATINGS: { r: Rating; label: string; key: string; color: ColorKey }[] = [
  { r: 1, label: "Again", key: "1", color: "red" },
  { r: 2, label: "Hard", key: "2", color: "orange" },
  { r: 3, label: "Good", key: "3", color: "green" },
  { r: 4, label: "Easy", key: "4", color: "blue" },
];

/** When a card would come back with this rating. */
function nextLabel(itemId: string, r: Rating) {
  const c = getState().cards[itemId];
  if (r === 1) return "1 min";
  const reps = (c?.reps ?? 0) + 1;
  const ease = c?.ease ?? 2.5;
  let d: number;
  if (reps === 1) d = r === 4 ? 3 : 1;
  else if (reps === 2) d = r === 2 ? 2 : r === 4 ? 7 : 4;
  else d = Math.round((c?.interval ?? 1) * ease * (r === 2 ? 0.8 : r === 4 ? 1.3 : 1));
  return d >= 30 ? `${Math.round(d / 30)} mo` : `${d} d`;
}

function buildQueue(entries: QueueEntry[]) {
  const s = getState();
  const now = Date.now();
  const due = entries.filter((e) => s.cards[e.item.id]?.seen && s.cards[e.item.id].due <= now);
  const fresh = entries.filter((e) => !s.cards[e.item.id]?.seen);
  const rest = entries.filter((e) => s.cards[e.item.id]?.seen && s.cards[e.item.id].due > now);
  return [...due, ...fresh, ...rest];
}

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;

function SwipeCard({ entry, flipped, onFlip, onSwipe, dirRef }: { entry: QueueEntry; flipped: boolean; onFlip: () => void; onSwipe: (r: Rating) => void; dirRef: { current: number } }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-10, 10]);
  const goodOpacity = useTransform(x, [20, 110], [0, 1]);
  const againOpacity = useTransform(x, [-110, -20], [1, 0]);
  const dragged = useRef(false);
  const c = colorVar(entry.deck.color);

  return (
    <motion.div
      className="absolute inset-0 perspective-1000 touch-pan-y"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin={false}
      dragElastic={1}
      dragMomentum={false}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={(_, info) => {
        setTimeout(() => (dragged.current = false), 40);
        // Decide by flick direction first, then distance: a quick flick is enough.
        const v = info.velocity.x;
        if (v > SWIPE_VELOCITY || (info.offset.x > SWIPE_DISTANCE && v > -SWIPE_VELOCITY)) onSwipe(3);
        else if (v < -SWIPE_VELOCITY || (info.offset.x < -SWIPE_DISTANCE && v < SWIPE_VELOCITY)) onSwipe(1);
        else animate(x, 0, { ...springBouncy, velocity: v });
      }}
      onClick={() => !dragged.current && onFlip()}
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      variants={{
        exit: () => {
          // Leave in the direction it was thrown; button ratings fall back to the rating direction.
          const dir = Math.sign(x.get()) || dirRef.current;
          return { x: dir * 600, opacity: 0, transition: { ...spring, duration: 0.45 } };
        },
      }}
      exit="exit"
      transition={spring}
    >
      <motion.div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", duration: 0.55, bounce: 0.12 }}>
        {/* Front: a ruled index card, the prompt above the margin line */}
        <div className="absolute inset-0 backface-hidden ruled rounded-[3px] border border-line shadow-(--shadow-float) overflow-hidden flex flex-col">
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: c }} aria-hidden />
          <div className="h-[3.25rem] flex items-center justify-between px-5 t-footnote text-ink-2">
            <span className="truncate">{entry.deck.title}</span>
            <span className="shrink-0">Front</span>
          </div>
          <div className="flex-1 grid place-items-center px-8 sm:px-14 pb-10">
            <h2 className="font-serif text-[2rem] sm:text-[2.75rem] leading-[1.1] text-ink text-center text-balance">{entry.item.prompt}</h2>
          </div>
          <span className="absolute bottom-4 inset-x-0 text-center t-footnote text-ink-3">Tap or press space to turn over</span>
        </div>
        {/* Back: the plain reverse of the card */}
        <div className="absolute inset-0 backface-hidden rounded-[3px] border border-line shadow-(--shadow-float) overflow-hidden flex flex-col bg-surface" style={{ transform: "rotateY(180deg)" }}>
          <div className="h-[3.25rem] flex items-center justify-between px-5 t-footnote text-ink-2 border-b border-line">
            <span className="truncate font-serif text-[1.05rem] text-ink">{entry.item.prompt}</span>
            <span className="shrink-0 ml-3">Back</span>
          </div>
          <div className="flex-1 grid place-items-center px-8 sm:px-14 py-6 overflow-y-auto">
            <div className="text-center max-w-lg">
              <p className="text-[1.25rem] sm:text-[1.5rem] leading-snug text-ink font-medium text-balance">{entry.item.answer}</p>
              {entry.item.explanation && entry.item.explanation !== entry.item.answer && <p className="t-subhead text-ink-2 mt-4 italic font-serif text-[1.05rem]">{entry.item.explanation}</p>}
            </div>
          </div>
        </div>
      </motion.div>
      {/* Swipe hints */}
      <motion.span style={{ opacity: goodOpacity }} className="absolute top-14 right-5 flex items-center gap-1 h-8 px-3 rounded-[4px] border-2 border-green text-green bg-surface t-footnote font-bold uppercase tracking-[0.08em] rotate-6 pointer-events-none">
        <I.check className="w-3.5 h-3.5" /> Know it
      </motion.span>
      <motion.span style={{ opacity: againOpacity }} className="absolute top-14 left-5 flex items-center gap-1 h-8 px-3 rounded-[4px] border-2 border-red text-red bg-surface t-footnote font-bold uppercase tracking-[0.08em] -rotate-6 pointer-events-none">
        <I.restart className="w-3.5 h-3.5" /> Again
      </motion.span>
    </motion.div>
  );
}

export function Flashcards() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const state = useStore();
  const isReview = !deckId;
  const deck = deckId ? state.decks.find((d) => d.id === deckId) : undefined;
  const exitTo = deck ? `/deck/${deck.id}` : "/";

  // Snapshot the queue source once per session so answering doesn't reshuffle it.
  const source = useMemo<QueueEntry[]>(() => (deck ? deck.items.map((item) => ({ deck, item })) : dueItems(getState())), [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [queue, setQueue] = useState<QueueEntry[]>(() => buildQueue(source));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<{ first: Record<string, boolean>; xp: number }>({ first: {}, xp: 0 });
  const [history, setHistory] = useState<{ index: number; queueLen: number; stats: typeof stats }[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [done, setDone] = useState(false);
  const logged = useRef(false);
  const exitDir = useRef(1);

  const current = queue[index];
  const firsts = Object.values(stats.first);
  const score = { correct: firsts.filter(Boolean).length, total: firsts.length };

  const rate = useCallback(
    (r: Rating) => {
      if (!current || done) return;
      exitDir.current = r === 1 ? -1 : 1;
      const xp = actions.answer(current.item.id, r);
      feedback(r === 1 ? "wrong" : "correct");
      setHistory((h) => [...h, { index, queueLen: queue.length, stats }]);
      // Score each card on its first attempt so repeats don't inflate the total.
      setStats((s) => ({ first: current.item.id in s.first ? s.first : { ...s.first, [current.item.id]: r >= 2 }, xp: s.xp + xp }));
      if (r === 1) setQueue((q) => [...q, current]);
      setFlipped(false);
      if (index + 1 >= queue.length + (r === 1 ? 1 : 0)) setDone(true);
      else setIndex((i) => i + 1);
    },
    [current, done, index, queue.length, stats]
  );

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setIndex(last.index);
    setQueue((q) => q.slice(0, last.queueLen));
    setStats(last.stats);
    setFlipped(false);
    setDone(false);
  };

  useEffect(() => {
    if (!done || logged.current || score.total === 0) return;
    logged.current = true;
    actions.logSession({ deckId: deck?.id, deckTitle: deck?.title ?? "Review", mode: isReview ? "review" : "cards", correct: score.correct, total: score.total, durationMs: Date.now() - startedAt, xp: stats.xp });
    feedback("complete");
    if (score.correct / score.total >= 0.8) celebrate();
  }, [done, stats, score.correct, score.total, deck, isReview, startedAt]);

  const flip = () => {
    setFlipped((f) => !f);
    feedback("flip");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key) as Rating);
      else if (e.key === "ArrowRight") rate(3);
      else if (e.key === "ArrowLeft") rate(1);
      else if ((e.ctrlKey || e.metaKey) && e.key === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const restart = (entries = source) => {
    setQueue(buildQueue(entries));
    setIndex(0);
    setFlipped(false);
    setStats({ first: {}, xp: 0 });
    setHistory([]);
    setStartedAt(Date.now());
    setDone(false);
    logged.current = false;
  };

  if (deckId && !deck) {
    return <EmptyState icon={I.library} title="Deck not found" body="It may have been deleted." action={<Button onClick={() => navigate("/library")}>Back to Library</Button>} />;
  }

  if (source.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-16">
        <EmptyState
          icon={isReview ? I.success : I.cards}
          title={isReview ? "All caught up" : "No cards yet"}
          body={isReview ? "Nothing is due. Cards you study return here right before you'd forget them." : "Add some items to this deck first."}
          action={<Button onClick={() => navigate(isReview ? "/library" : `/edit/${deckId}`)}>{isReview ? "Study Something New" : "Add Items"}</Button>}
        />
      </div>
    );
  }

  if (done) {
    return <SessionSummary title={deck ? deck.title : "Review"} correct={score.correct} total={score.total} xp={stats.xp} durationMs={Date.now() - startedAt} onAgain={() => restart()} onDone={() => navigate(exitTo)} />;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <StudyHeader
        progress={index / queue.length}
        label={`${Math.min(index + 1, queue.length)}/${queue.length}`}
        exitTo={exitTo}
        right={
          <div className="flex">
            <IconButton icon={I.undo} label="Undo" onClick={undo} disabled={!history.length} />
            <IconButton icon={I.shuffle} label="Shuffle" onClick={() => restart(shuffle(source))} />
          </div>
        }
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl w-full mx-auto">
        <div className="relative w-full h-[min(58vh,440px)]">
          {queue[index + 1] && <div className="absolute inset-0 rounded-[3px] card rotate-[1.2deg] translate-y-1.5" aria-hidden />}
          <AnimatePresence initial={false}>
            <SwipeCard key={`${current.item.id}-${index}`} entry={current} flipped={flipped} onFlip={flip} onSwipe={rate} dirRef={exitDir} />
          </AnimatePresence>
        </div>

        <div className="w-full mt-8 min-h-[92px]">
          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              <motion.div key="rate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={springFast} className="grid grid-cols-4 gap-2">
                {RATINGS.map(({ r, label, key, color }) => (
                  <button
                    key={r}
                    onClick={() => rate(r)}
                    className="press group rounded-[4px] py-3 flex flex-col items-center gap-0.5 bg-surface shadow-[inset_0_0_0_1px_var(--c-line)] hover:shadow-[inset_0_0_0_1.5px_currentColor] transition-shadow"
                    style={{ color: colorVar(color) }}
                  >
                    <span className="font-serif text-[1.35rem] leading-none">{label}</span>
                    <span className="t-caption text-ink-2 mt-1">{nextLabel(current.item.id, r)}</span>
                    <span className="hidden sm:block mt-1">
                      <Kbd>{key}</Kbd>
                    </span>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="text-center">
                <Button size="lg" className="w-full sm:w-72" onClick={flip}>
                  Show Answer
                </Button>
                <p className="t-footnote text-ink-2 mt-3">Swipe right if you knew it, left to see it again</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
