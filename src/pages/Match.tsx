import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { actions, useStore } from "../lib/store";
import { StudyHeader } from "../components/StudyShell";
import { Button, EmptyState, IconTile } from "../components/ui";
import { I } from "../components/icons";
import { celebrate, feedback } from "../lib/feedback";
import { spring, springBouncy } from "../lib/motion";
import { cn, formatMs, shuffle } from "../lib/utils";

interface Tile {
  key: string;
  pairId: string;
  text: string;
  side: "prompt" | "answer";
}

const PAIRS = 6;
const PENALTY_MS = 1000;

/** Writes straight to the DOM every frame: the tile grid never re-renders for the clock. */
function Clock({ startRef, penalty, running, finalMs }: { startRef: React.RefObject<number>; penalty: number; running: boolean; finalMs: number | null }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (el.current) el.current.textContent = formatMs(performance.now() - startRef.current + penalty);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, penalty, startRef]);
  return <span ref={el}>{finalMs !== null ? formatMs(finalMs) : running ? "0.0s" : "—"}</span>;
}

export function Match() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { decks, bestMatchMs } = useStore();
  const deck = decks.find((d) => d.id === deckId);

  const [phase, setPhase] = useState<"intro" | "countdown" | "play" | "done">("intro");
  const [count, setCount] = useState(3);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [penalty, setPenalty] = useState(0);
  const [result, setResult] = useState<{ ms: number; isBest: boolean; previous?: number } | null>(null);
  const startRef = useRef(0);

  const setup = () => {
    if (!deck) return;
    const picks = shuffle(deck.items).slice(0, Math.min(PAIRS, deck.items.length));
    setTiles(
      shuffle(
        picks.flatMap((it) => [
          { key: `${it.id}-p`, pairId: it.id, text: it.prompt, side: "prompt" as const },
          { key: `${it.id}-a`, pairId: it.id, text: it.answer, side: "answer" as const },
        ])
      )
    );
    setMatched(new Set());
    setSelected(null);
    setWrong([]);
    setPenalty(0);
    setResult(null);
    setCount(3);
    setPhase("countdown");
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    feedback("tick");
    if (count === 0) {
      startRef.current = performance.now();
      setPhase("play");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 600);
    return () => clearTimeout(t);
  }, [phase, count]);

  const pick = (tile: Tile) => {
    if (phase !== "play" || matched.has(tile.pairId) || wrong.length) return;
    if (!selected) {
      setSelected(tile);
      feedback("tap");
      return;
    }
    if (selected.key === tile.key) return setSelected(null);
    if (selected.pairId === tile.pairId && selected.side !== tile.side) {
      const next = new Set(matched).add(tile.pairId);
      setMatched(next);
      setSelected(null);
      feedback("correct");
      if (next.size * 2 === tiles.length) {
        const ms = performance.now() - startRef.current + penalty;
        const rec = actions.recordMatch(deck!.id, ms);
        const xp = 20 + next.size * 3;
        actions.addXp(xp);
        actions.logSession({ deckId: deck!.id, deckTitle: deck!.title, mode: "match", correct: next.size, total: next.size, durationMs: ms, xp });
        setResult({ ms, ...rec });
        setPhase("done");
        feedback("complete");
        if (rec.isBest) celebrate();
      }
    } else {
      setWrong([selected.key, tile.key]);
      setPenalty((p) => p + PENALTY_MS);
      feedback("wrong");
      setTimeout(() => {
        setWrong([]);
        setSelected(null);
      }, 420);
    }
  };

  if (!deck || deck.items.length < 3) {
    return <EmptyState icon={I.puzzle} title="Not enough items" body="Match needs at least three items in a deck." action={<Button onClick={() => navigate(deck ? `/deck/${deck.id}` : "/library")}>Go Back</Button>} />;
  }

  const best = bestMatchMs[deck.id];

  return (
    <div className="min-h-dvh flex flex-col">
      <StudyHeader
        progress={tiles.length ? (matched.size * 2) / tiles.length : 0}
        label={<Clock startRef={startRef} penalty={penalty} running={phase === "play"} finalMs={result?.ms ?? null} />}
        exitTo={`/deck/${deck.id}`}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={spring} className="flex-1 flex flex-col items-center justify-center text-center">
              <IconTile icon={I.puzzle} color="green" size={80} />
              <h1 className="t-large text-ink mt-6">Match</h1>
              <p className="t-body text-ink-2 mt-2 max-w-sm">Pair every term with its answer as fast as you can. Wrong pairs add one second.</p>
              {best !== undefined && (
                <p className="mt-4 inline-flex items-center gap-1.5 t-subhead font-semibold text-ink-2">
                  <I.trophy className="w-4 h-4 text-yellow" /> Best {formatMs(best)}
                </p>
              )}
              <Button size="lg" className="mt-8 w-56" onClick={setup}>
                Start
              </Button>
            </motion.div>
          )}

          {phase === "countdown" && (
            <motion.div key="count" className="flex-1 grid place-items-center" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              <AnimatePresence mode="popLayout">
                <motion.span key={count} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0, transition: { duration: 0.12 } }} transition={springBouncy} className="text-[120px] font-bold tracking-[-0.04em] text-accent leading-none tabular-nums">
                  {count === 0 ? "Go" : count}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}

          {phase === "play" && (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {tiles.map((tile) => {
                const isMatched = matched.has(tile.pairId);
                const isSel = selected?.key === tile.key;
                const isWrong = wrong.includes(tile.key);
                return (
                  <button
                    key={tile.key}
                    onClick={() => pick(tile)}
                    disabled={isMatched}
                    className={cn(
                      "min-h-28 sm:min-h-32 p-4 rounded-[4px] t-subhead font-medium text-center text-ink transition-[transform,opacity,background-color,box-shadow] duration-300 ease-out-strong active:scale-[0.97]",
                      isMatched ? "opacity-0 scale-90 pointer-events-none" : "card",
                      isSel && "bg-accent/12 shadow-[inset_0_0_0_2px_var(--c-accent)] scale-[1.02]",
                      isWrong && "bg-red/10 shadow-[inset_0_0_0_2px_var(--sys-red)] animate-shake"
                    )}
                  >
                    <span className="line-clamp-5">{tile.text}</span>
                  </button>
                );
              })}
            </motion.div>
          )}

          {phase === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="flex-1 flex flex-col items-center justify-center text-center">
              <p className="t-num text-[88px] leading-none text-ink">{formatMs(result.ms)}</p>
              <p className="t-headline mt-3" style={{ color: result.isBest ? "var(--sys-green)" : "var(--c-ink-2)" }}>
                {result.isBest ? "New personal best" : "All pairs matched"}
              </p>
              {penalty > 0 && <p className="t-subhead text-ink-2 mt-3">Includes {penalty / 1000}s of penalties</p>}
              {!result.isBest && result.previous !== undefined && <p className="t-subhead text-ink-2 mt-1">Best {formatMs(result.previous)}</p>}
              {result.isBest && result.previous !== undefined && <p className="t-subhead font-semibold text-green mt-1">{formatMs(result.previous - result.ms)} faster</p>}
              <div className="grid grid-cols-2 gap-3 mt-10 w-full max-w-sm">
                <Button variant="gray" size="lg" onClick={() => navigate(`/deck/${deck.id}`)}>
                  Done
                </Button>
                <Button size="lg" onClick={setup}>
                  Play Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
