import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { AnimatedNumber, Button, ProgressRing } from "./ui";
import { I } from "./icons";
import { spring } from "../lib/motion";
import { formatMs } from "../lib/utils";

export function StudyHeader({ progress, label, exitTo, right }: { progress: number; label: ReactNode; exitTo: string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-40 bg-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <button onClick={() => navigate(exitTo)} aria-label="Close" className="press w-8 h-8 grid place-items-center rounded-full bg-fill text-ink-2">
          <I.x className="w-4 h-4" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-fill overflow-hidden">
          {/* scaleX runs on the compositor: no layout work per step */}
          <motion.div className="h-full w-full rounded-full bg-accent origin-left" initial={false} animate={{ scaleX: Math.max(0.02, Math.min(1, progress)) }} transition={spring} />
        </div>
        <div className="t-subhead font-semibold text-ink-2 tabular-nums min-w-10 text-right">{label}</div>
        {right}
      </div>
    </div>
  );
}

export function SessionSummary({
  title,
  correct,
  total,
  xp,
  durationMs,
  extra,
  onAgain,
  onDone,
  againLabel = "Study Again",
}: {
  title: string;
  correct: number;
  total: number;
  xp: number;
  durationMs: number;
  extra?: ReactNode;
  onAgain: () => void;
  onDone: () => void;
  againLabel?: string;
}) {
  const pct = total ? correct / total : 0;
  const verdict = pct === 1 ? "Perfect session" : pct >= 0.8 ? "Great work" : pct >= 0.5 ? "Solid progress" : "Every rep counts";
  const color = pct >= 0.8 ? "var(--sys-green)" : pct >= 0.5 ? "var(--sys-blue)" : "var(--sys-orange)";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="max-w-md mx-auto px-4 pt-12 pb-16 text-center">
      <h1 className="t-large text-ink">{verdict}</h1>
      <p className="t-subhead text-ink-2 mt-1.5">{title}</p>
      <div className="flex justify-center mt-8">
        <ProgressRing value={pct} size={176} stroke={16} color={color}>
          <div className="leading-none">
            <AnimatedNumber value={Math.round(pct * 100)} className="t-num text-[44px] text-ink" />
            <span className="t-title3 text-ink-2">%</span>
            <div className="t-footnote text-ink-2 mt-1.5">
              {correct} of {total} correct
            </div>
          </div>
        </ProgressRing>
      </div>
      <div className="grouped mt-8 text-left">
        <div className="flex items-center gap-3 px-4 h-12">
          <I.sparkle className="w-5 h-5 text-purple" />
          <span className="t-body text-ink flex-1">XP earned</span>
          <span className="t-headline text-ink tabular-nums">
            +<AnimatedNumber value={xp} />
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 h-12">
          <I.clock className="w-5 h-5 text-blue" />
          <span className="t-body text-ink flex-1">Time</span>
          <span className="t-headline text-ink tabular-nums">{formatMs(durationMs)}</span>
        </div>
      </div>
      {extra}
      <div className="grid grid-cols-2 gap-3 mt-8">
        <Button variant="gray" size="lg" onClick={onDone}>
          Done
        </Button>
        <Button size="lg" onClick={onAgain}>
          {againLabel}
        </Button>
      </div>
    </motion.div>
  );
}
