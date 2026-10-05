import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { I, type Icon } from "./icons";
import { spring } from "../lib/motion";

type Variant = "success" | "error" | "info" | "reward";

interface ToastItem {
  id: number;
  variant: Variant;
  title: ReactNode;
  description?: ReactNode;
  icon?: Icon;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastOptions {
  description?: ReactNode;
  icon?: Icon;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

function push(variant: Variant, title: ReactNode, opts: ToastOptions = {}) {
  const item: ToastItem = { id: nextId++, variant, title, duration: opts.duration ?? (opts.action ? 5500 : 3200), ...opts };
  items = [...items.slice(-2), item];
  emit();
  return item.id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: ReactNode, opts?: ToastOptions) => push("success", title, opts),
  error: (title: ReactNode, opts?: ToastOptions) => push("error", title, opts),
  info: (title: ReactNode, opts?: ToastOptions) => push("info", title, opts),
  reward: (title: ReactNode, opts?: ToastOptions) => push("reward", title, opts),
};

const DEFAULTS: Record<Variant, { icon: Icon; color: string }> = {
  success: { icon: I.success, color: "#93bd86" },
  error: { icon: I.warning, color: "#f07a61" },
  info: { icon: I.info, color: "#d8cdb8" },
  reward: { icon: I.award, color: "#dcb85a" },
};

/** A printed slip: ink paper, drops from the top, swipe up to dismiss. */
function Slip({ t }: { t: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.duration);
  const started = useRef(Date.now());
  const { icon: IconC, color } = { ...DEFAULTS[t.variant], ...(t.icon ? { icon: t.icon } : {}) };

  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const timer = setTimeout(() => dismissToast(t.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started.current;
    };
  }, [paused, t.id]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
      transition={spring}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.9, bottom: 0.08 }}
      onDragEnd={(_, info) => (info.offset.y < -24 || info.velocity.y < -300) && dismissToast(t.id)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      role="status"
      className="pointer-events-auto flex items-center gap-3 pl-3.5 pr-2 py-2.5 min-h-12 rounded-md bg-[#1b1813] text-[#f3eee4] shadow-[0_18px_40px_-14px_rgba(27,24,19,0.55)] ring-1 ring-white/5 max-w-[min(460px,calc(100vw-24px))] touch-none"
    >
      <IconC className="w-5 h-5 shrink-0" style={{ color }} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="t-subhead font-semibold leading-snug">{t.title}</div>
        {t.description && <div className="t-footnote text-[#f3eee4]/65 leading-snug">{t.description}</div>}
      </div>
      {t.action ? (
        <button
          type="button"
          onClick={() => {
            t.action!.onClick();
            dismissToast(t.id);
          }}
          className="shrink-0 h-8 px-3 rounded-[4px] t-subhead font-semibold text-[#1b1813] bg-[#f3eee4] hover:bg-white active:translate-y-px transition"
        >
          {t.action.label}
        </button>
      ) : (
        <span className="w-1" />
      )}
    </motion.div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => items
  );
  return (
    <div aria-live="polite" className="fixed z-100 top-[max(12px,env(safe-area-inset-top))] inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-3">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <Slip key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
