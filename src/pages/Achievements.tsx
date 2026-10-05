import { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ACHIEVEMENTS, dayKey, levelInfo, streakInfo, useStore } from "../lib/store";
import { AnimatedNumber, Group, PageHeader, ProgressRing, Row } from "../components/ui";
import { I, colorVar, type Icon, type ColorKey } from "../components/icons";
import { list } from "../lib/motion";
import { cn, formatMs, timeAgo } from "../lib/utils";

const MODE: Record<string, { label: string; icon: Icon; color: ColorKey }> = {
  cards: { label: "Flashcards", icon: I.cards, color: "orange" },
  learn: { label: "Learn", icon: I.review, color: "indigo" },
  test: { label: "Test", icon: I.target, color: "red" },
  exam: { label: "Exam", icon: I.cap, color: "indigo" },
  match: { label: "Match", icon: I.puzzle, color: "green" },
  review: { label: "Review", icon: I.review, color: "purple" },
  focus: { label: "Focus", icon: I.focus, color: "mint" },
};
const WEEKS = 52;

function Heatmap({ activity, goal }: { activity: Record<string, { xp: number }>; goal: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Most recent weeks are on the right.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);

  const days = useMemo(() => {
    const out: { key: string; xp: number; label: string }[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7 - 1) - today.getDay());
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      out.push({ key: k, xp: activity[k]?.xp ?? 0, label: d.toDateString() });
    }
    return out;
  }, [activity]);

  // Plain divs, no per-cell animation: hundreds of cells stay cheap.
  return (
    <div ref={scroller} className="overflow-x-auto scrollbar-hide">
      <div className="grid grid-rows-7 grid-flow-col gap-0.75 w-max">
        {days.map((d) => {
          const level = d.xp === 0 ? 0 : Math.min(1, 0.25 + (d.xp / goal) * 0.75);
          return <div key={d.key} title={`${d.label}: ${d.xp} XP`} className="w-2.75 h-2.75 sm:w-3 sm:h-3 rounded-[1px] bg-fill" style={level ? { background: `color-mix(in srgb, var(--c-ink) ${Math.round(level * 85)}%, var(--c-fill))` } : undefined} />;
        })}
      </div>
    </div>
  );
}

export function Achievements() {
  const state = useStore();
  const lvl = levelInfo(state.xp);
  const streak = streakInfo(state.activity);
  const totals = useMemo(() => {
    const days = Object.values(state.activity);
    const answered = days.reduce((a, d) => a + d.answered, 0);
    const correct = days.reduce((a, d) => a + d.correct, 0);
    return { answered, accuracy: answered ? Math.round((correct / answered) * 100) : 0, focus: days.reduce((a, d) => a + d.focusMinutes, 0) };
  }, [state.activity]);

  const chart = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return { day: d.toLocaleDateString("en-US", { weekday: "narrow" }), full: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), xp: state.activity[dayKey(d)]?.xp ?? 0 };
      }),
    [state.activity]
  );
  const avg = Math.round(chart.reduce((a, c) => a + c.xp, 0) / chart.length);
  const activeDays = Object.values(state.activity).filter((d) => d.xp > 0).length;
  const earned = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;

  const highlights: { label: string; icon: Icon; color: ColorKey; value: number; unit: string; sub: string }[] = [
    { label: "Level", icon: I.sparkle, color: "purple", value: lvl.level, unit: "", sub: `${lvl.span - lvl.into} XP to next` },
    { label: "Streak", icon: I.fire, color: "orange", value: streak.current, unit: streak.current === 1 ? "day" : "days", sub: `Best ${streak.best}` },
    { label: "Accuracy", icon: I.target, color: "green", value: totals.accuracy, unit: "%", sub: `${totals.answered.toLocaleString()} answered` },
    { label: "Focus", icon: I.meditate, color: "mint", value: totals.focus, unit: "min", sub: `${state.sessions.length} ${state.sessions.length === 1 ? "session" : "sessions"}` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-12">
      <PageHeader title="Progress" subtitle={`${state.xp.toLocaleString()} XP earned`} />

      <motion.div variants={list.container} initial="hidden" animate="show" className="space-y-8">
        {/* Summary */}
        <motion.div variants={list.item}>
          <Group>
            {highlights.map((h) => (
              <Row
                key={h.label}
                icon={h.icon}
                color={h.color}
                title={h.label}
                subtitle={h.sub}
                trailing={
                  <span className="t-title3 t-num text-ink">
                    <AnimatedNumber value={h.value} />
                    {h.unit && <span className="t-subhead text-ink-2 font-medium"> {h.unit}</span>}
                  </span>
                }
              />
            ))}
          </Group>
        </motion.div>

        {/* XP chart */}
        <motion.section variants={list.item} className="pt-5 border-t-[1.5px] border-rule">
          <h2 className="t-headline text-ink">XP per day</h2>
          <p className="t-subhead text-ink-2">
            Averaging <span className="font-semibold text-ink t-num">{avg} XP</span> over the last 14 days, against a goal of {state.settings.dailyGoal}.
          </p>
          <div className="h-44 mt-4 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--c-ink-2)", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "var(--c-fill)", radius: 6 }}
                  contentStyle={{ background: "var(--c-elevated)", border: "1px solid var(--c-line)", borderRadius: 4, boxShadow: "var(--shadow-float)", color: "var(--c-ink)", fontSize: 13 }}
                  labelFormatter={(_, p) => p?.[0]?.payload?.full}
                  formatter={(v) => [`${v} XP`, ""]}
                  separator=""
                />
                <Bar dataKey="xp" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={700}>
                  {chart.map((d, i) => (
                    <Cell key={i} fill={i === chart.length - 1 ? "var(--c-accent)" : "var(--c-ink)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Heatmap */}
        <motion.section variants={list.item} className="pt-5 border-t-[1.5px] border-rule">
          <div className="flex items-baseline justify-between mb-4">
            <p className="t-headline text-ink">Activity</p>
            <p className="t-footnote text-ink-2">{activeDays} active {activeDays === 1 ? "day" : "days"} this year</p>
          </div>
          <Heatmap activity={state.activity} goal={state.settings.dailyGoal} />
        </motion.section>

        {/* Awards */}
        <motion.section variants={list.item}>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="t-title2 text-ink">Awards</h2>
            <p className="t-subhead text-ink-2">
              {earned} of {ACHIEVEMENTS.length}
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-6">
            {ACHIEVEMENTS.map((a) => {
              const at = state.achievements[a.id];
              const prog = Math.min(a.goal, a.progress(state));
              const IconC = I[a.icon];
              const c = colorVar(a.color);
              return (
                <div key={a.id} className="flex flex-col items-center text-center">
                  {at ? (
                    <span className="w-19 h-19 rounded-full grid place-items-center bg-surface" style={{ color: c, boxShadow: `inset 0 0 0 2px ${c}, inset 0 0 0 5px var(--c-surface), inset 0 0 0 6px ${c}` }}>
                      <IconC className="w-8 h-8" />
                    </span>
                  ) : (
                    <ProgressRing value={prog / a.goal} size={76} stroke={2} color={c}>
                      <IconC className="w-8 h-8 text-ink-3" />
                    </ProgressRing>
                  )}
                  <p className={cn("t-footnote font-semibold mt-2", at ? "text-ink" : "text-ink-2")}>{a.name}</p>
                  <p className="t-caption text-ink-2 leading-tight mt-0.5">{at ? timeAgo(at) : `${prog.toLocaleString()} / ${a.goal.toLocaleString()}`}</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* History */}
        <motion.div variants={list.item}>
          <Group header="Recent sessions" footer={state.sessions.length === 0 ? "Your study history will appear here." : undefined}>
            {state.sessions.slice(0, 10).map((s) => {
              const m = MODE[s.mode] ?? MODE.cards;
              return (
                <Row
                  key={s.id}
                  icon={m.icon}
                  color={m.color}
                  title={s.mode === "focus" ? `${Math.round(s.durationMs / 60000)} min focus` : (s.deckTitle ?? m.label)}
                  subtitle={`${m.label} · ${timeAgo(s.at)}${s.total > 0 ? ` · ${Math.round((s.correct / s.total) * 100)}%` : ""} · ${formatMs(s.durationMs)}`}
                  trailing={<span className="t-subhead font-semibold text-purple tabular-nums">+{s.xp}</span>}
                />
              );
            })}
            {state.sessions.length === 0 && <Row icon={I.clock} color="gray" title="No sessions yet" />}
          </Group>
        </motion.div>
      </motion.div>
    </div>
  );
}
