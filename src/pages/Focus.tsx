import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { actions, dayKey, useStore } from "../lib/store";
import { Group, PageHeader, Row, Segmented } from "../components/ui";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { confetti, feedback } from "../lib/feedback";
import { cn } from "../lib/utils";

type Phase = "focus" | "break";
const PRESETS = [15, 25, 45, 60];

/** iOS Clock-style round button with the double-ring edge. */
function RoundButton({ children, onClick, tone, label }: { children: React.ReactNode; onClick: () => void; tone: "gray" | "green" | "orange"; label: string }) {
  const filled = tone !== "gray";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("press w-21 h-21 rounded-full grid place-items-center t-callout font-semibold transition-colors", filled ? "bg-ink text-on-ink hover:bg-ink/85" : "text-ink shadow-[inset_0_0_0_1.5px_var(--c-ink)] hover:bg-fill")}
    >
      {children}
    </button>
  );
}

export function Focus() {
  const { settings, activity } = useStore();
  const [phase, setPhase] = useState<Phase>("focus");
  const total = (phase === "focus" ? settings.focusMinutes : settings.breakMinutes) * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const endAt = useRef<number | null>(null);
  const todayFocus = activity[dayKey()]?.focusMinutes ?? 0;

  useEffect(() => {
    if (!running) setLeft(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, phase]);

  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    // Re-renders only when the displayed second changes (React bails out on equal state).
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt.current! - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) complete();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  useEffect(() => {
    if (!running) return;
    const prev = document.title;
    document.title = `${mm}:${ss} · ${phase === "focus" ? "Focus" : "Break"}`;
    return () => {
      document.title = prev;
    };
  }, [running, mm, ss, phase]);

  const complete = () => {
    setRunning(false);
    feedback("complete");
    if (phase === "focus") {
      const xp = actions.logFocus(settings.focusMinutes);
      setRounds((r) => r + 1);
      confetti({ y: 0.4, count: 90 });
      toast.reward(`Focus complete · +${xp} XP`, { description: "Take a short break.", icon: I.meditate });
      setPhase("break");
    } else {
      toast.info("Break's over", { description: "Ready for another round?", icon: I.coffee });
      setPhase("focus");
    }
  };

  const size = 280;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = phase === "focus" ? "var(--c-accent)" : "var(--sys-green)";
  const started = left < total;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-12">
      <PageHeader title="Focus" subtitle={`${todayFocus} min focused today`} />

      <div className="flex justify-center">
        <Segmented<Phase>
          value={phase}
          onChange={(p) => {
            setRunning(false);
            setPhase(p);
          }}
          options={[
            { value: "focus", label: "Focus", icon: I.meditate },
            { value: "break", label: "Break", icon: I.coffee },
          ]}
        />
      </div>

      <div className="relative mx-auto mt-8" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={1} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - left / total)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="t-figure text-[6.5rem] tabular-nums text-ink">
              {mm}:{ss}
            </p>
            <p className="t-subhead text-ink-2 mt-2">{phase === "focus" ? (running ? "Stay with it" : "Ready") : "Recharge"}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 px-2">
        <RoundButton
          tone="gray"
          label="Cancel"
          onClick={() => {
            setRunning(false);
            setLeft(total);
          }}
        >
          Cancel
        </RoundButton>
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full"
              animate={{ backgroundColor: i < (rounds % 4 || (rounds ? 4 : 0)) ? "var(--c-accent)" : "var(--c-line)", scale: i === (rounds - 1) % 4 ? [1, 1.6, 1] : 1 }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
        <RoundButton
          tone={running ? "orange" : "green"}
          label={running ? "Pause" : "Start"}
          onClick={() => {
            setRunning((v) => !v);
            feedback("tap");
          }}
        >
          {running ? "Pause" : started ? "Resume" : "Start"}
        </RoundButton>
      </div>

      <div className="space-y-7 mt-10">
        {phase === "focus" && (
          <Group header="Length">
            <div className="flex gap-2 p-3">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  disabled={running}
                  onClick={() => actions.updateSettings({ focusMinutes: m })}
                  className={cn("press flex-1 h-10 rounded-[4px] t-subhead font-semibold transition-colors disabled:opacity-40", settings.focusMinutes === m ? "bg-ink text-on-ink" : "text-ink shadow-[inset_0_0_0_1px_var(--c-line)] hover:shadow-[inset_0_0_0_1.5px_var(--c-ink)]")}
                >
                  {m} min
                </button>
              ))}
            </div>
          </Group>
        )}
        <Group footer="Each focus minute earns 2 XP and counts toward your streak.">
          <Row icon={I.skip} color="indigo" title={phase === "focus" ? "Skip to Break" : "Skip to Focus"} onClick={() => { setRunning(false); setPhase(phase === "focus" ? "break" : "focus"); }} />
        </Group>
      </div>
    </div>
  );
}
