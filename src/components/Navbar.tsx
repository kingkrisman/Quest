import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { I, type Icon } from "./icons";
import { Avatar } from "./ui";
import { actions, dueItems, streakInfo, useStore } from "../lib/store";
import { useAuth, useIsDark } from "../contexts/AuthContext";
import { springFast } from "../lib/motion";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  iconActive: Icon;
}

const NAV: NavItem[] = [
  { to: "/", label: "Today", icon: I.home, iconActive: I.homeFill },
  { to: "/library", label: "Library", icon: I.library, iconActive: I.libraryFill },
  { to: "/review", label: "Review", icon: I.review, iconActive: I.reviewFill },
  { to: "/focus", label: "Focus", icon: I.focus, iconActive: I.focusFill },
  { to: "/stats", label: "Progress", icon: I.progress, iconActive: I.progressFill },
];

/** Screens that take over the viewport. */
export const IMMERSIVE = /^\/(study|game)/;

const isActive = (pathname: string, to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif leading-none tracking-[-0.01em] text-ink", className)}>
      Kàwé<span className="text-accent">.</span>
    </span>
  );
}

export function Masthead() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const state = useStore();
  const isDark = useIsDark();
  const due = dueItems(state).length;
  const streak = streakInfo(state.activity);
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <header className="sticky top-0 z-40 material">
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* Dateline (desktop) */}
        <div className="hidden md:flex items-center justify-between h-8 t-footnote text-ink-2 border-b border-line">
          <span>{date}</span>
          <span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              {streak.activeToday ? <I.fireFill className="w-3.5 h-3.5 text-accent" aria-hidden /> : <I.fire className="w-3.5 h-3.5" aria-hidden />}
              {streak.current > 0 ? `${streak.current}-day streak` : "No streak yet"}
            </span>
            {due > 0 && (
              <Link to="/review" className="hover:text-ink underline-offset-4 hover:underline">
                {due} {due === 1 ? "card" : "cards"} due
              </Link>
            )}
          </span>
        </div>

        <div className="flex items-center gap-6 h-16">
          <Link to="/" aria-label="KÀWÉ home" className="shrink-0">
            <Wordmark className="text-[2rem]" />
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-6 ml-4">
            {NAV.map(({ to, label }) => {
              const active = isActive(pathname, to);
              return (
                <NavLink key={to} to={to} className={cn("relative h-16 inline-flex items-center t-subhead transition-colors", active ? "text-ink font-semibold" : "text-ink-2 hover:text-ink")}>
                  {label}
                  {to === "/review" && due > 0 && <span className="ml-1.5 t-caption t-num text-accent">{due}</span>}
                  {active && <motion.span layoutId="mast-underline" className="absolute left-0 right-0 bottom-3 h-0.5 bg-ink" transition={springFast} />}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link to="/import" className="btn btn-tinted hidden sm:inline-flex h-9 px-3 gap-1.5 t-subhead">
              <I.scan className="w-4.5 h-4.5" aria-hidden />
              Scan notes
            </Link>
            <Link to="/create" aria-label="New deck" title="New deck" className="btn btn-filled h-9 w-9 sm:w-auto sm:px-3 gap-1.5 t-subhead">
              <I.plus className="w-4.5 h-4.5" aria-hidden />
              <span className="hidden sm:inline">New deck</span>
            </Link>
            <button type="button" onClick={() => actions.updateSettings({ theme: isDark ? "light" : "dark" })} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="btn w-9 h-9 text-ink-2 hover:text-ink hover:bg-fill">
              {isDark ? <I.sun className="w-5 h-5" aria-hidden /> : <I.moon className="w-5 h-5" aria-hidden />}
            </button>
            <Link to="/profile" aria-label="Settings and profile" className="rounded-full">
              <Avatar name={user.name} color={user.color} size={34} />
            </Link>
          </div>
        </div>
        <div className="rule-double" />
      </div>
    </header>
  );
}

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-bg border-t-[1.5px] border-rule pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14">
        {NAV.map(({ to, label, icon, iconActive }) => {
          const active = isActive(pathname, to);
          const IconC = active ? iconActive : icon;
          return (
            <NavLink key={to} to={to} className={cn("flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity", active ? "text-ink" : "text-ink-2")}>
              <IconC className="w-6 h-6" aria-hidden />
              <span className={cn("text-[10.5px] tracking-[0.01em]", active && "font-semibold")}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
