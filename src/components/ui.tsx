import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { COLORS, DECK_ICONS, I, colorVar, type ColorKey, type DeckIconKey, type Icon } from "./icons";
import { spring, springFast } from "../lib/motion";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                               */
/* ------------------------------------------------------------------ */

type ButtonVariant = "filled" | "tinted" | "gray" | "plain";
type ButtonSize = "sm" | "md" | "lg";
type ButtonColor = ColorKey | "accent" | "ink";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ink by default. "accent" is the tomato reserved for a screen's single most important action. */
  color?: ButtonColor;
  loading?: boolean;
  icon?: Icon;
}

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.875rem] gap-1.5",
  md: "h-10 px-4 text-[0.9375rem] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const btnVars = (color: ButtonColor) =>
  color === "ink"
    ? {}
    : color === "accent"
      ? { ["--btn-c" as string]: "var(--c-accent)", ["--btn-fg" as string]: "var(--c-on-accent)" }
      : { ["--btn-c" as string]: colorVar(color), ["--btn-fg" as string]: "#fff" };

/**
 * States live in index.css (btn, btn-filled, ...): hover, focus-visible, active,
 * disabled and loading behave identically everywhere. Loading keeps the width.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", color = "ink", loading, icon: IconC, className, style, children, disabled, type = "button", onClick, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      style={{ ...btnVars(color), ...style }}
      className={cn("btn", `btn-${variant}`, variant === "plain" ? "px-0.5 h-auto" : SIZES[size], className)}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>
        {IconC && <IconC className={size === "lg" ? "w-5 h-5" : "w-4.5 h-4.5"} aria-hidden />}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={16} />
        </span>
      )}
    </button>
  );
});

export function IconButton({ icon: IconC, label, className, type = "button", ...rest }: { icon: Icon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} aria-label={label} title={label} className={cn("btn w-9 h-9 text-ink-2 hover:text-ink hover:bg-fill active:bg-fill-2", className)} {...rest}>
      <IconC className="w-5 h-5" aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Marks: a stamped square carrying a glyph in a printing-ink color      */
/* ------------------------------------------------------------------ */

export function IconTile({ icon: IconC, color, size = 32, className }: { icon: Icon; color: ColorKey; size?: number; className?: string }) {
  const c = colorVar(color);
  return (
    <span
      className={cn("grid place-items-center shrink-0", className)}
      style={{ width: size, height: size, borderRadius: Math.max(4, size * 0.16), color: c, background: `color-mix(in srgb, ${c} 12%, var(--c-surface))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 35%, transparent)` }}
    >
      <IconC style={{ width: size * 0.56, height: size * 0.56 }} aria-hidden />
    </span>
  );
}

export function DeckTile({ icon, color, size = 48, className }: { icon: DeckIconKey; color: ColorKey; size?: number; className?: string }) {
  return <IconTile icon={DECK_ICONS[icon] ?? DECK_ICONS.book} color={color} size={size} className={className} />;
}

/* ------------------------------------------------------------------ */
/* Avatar: serif initials on an ink-colored disc                         */
/* ------------------------------------------------------------------ */

export const encodeAvatar = (color: ColorKey) => `mono:${color}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, value, color, size = 36, className }: { name: string; value?: string | null; color?: ColorKey; size?: number; className?: string }) {
  if (value && /^https?:/.test(value)) {
    return <img src={value} alt="" className={cn("rounded-full object-cover bg-fill shrink-0", className)} style={{ width: size, height: size }} />;
  }
  let c: ColorKey = color ?? "gray";
  if (value?.startsWith("mono:")) {
    const k = value.slice(5) as ColorKey;
    if ((COLORS as readonly string[]).includes(k)) c = k;
  }
  return (
    <span
      className={cn("rounded-full grid place-items-center shrink-0 select-none font-serif text-[#fbf8f2]", className)}
      style={{ width: size, height: size, fontSize: size * 0.46, background: colorVar(c), lineHeight: 1 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                             */
/* ------------------------------------------------------------------ */

export function ProgressRing({ value, size = 64, stroke = 4, color = "var(--c-ink)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ * (1 - v) }} transition={{ type: "spring", duration: 1, bounce: 0 }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** A labelled ledger line: name on the left, figure on the right, a thin bar beneath. */
export function Meter({ label, value, max, unit, color = "var(--c-ink)", done }: { label: ReactNode; value: number; max: number; unit?: string; color?: string; done?: boolean }) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-subhead text-ink">{label}</span>
        <span className="t-subhead t-num text-ink">
          {value.toLocaleString()}
          <span className="text-ink-3 font-normal">
            {" "}
            / {max.toLocaleString()}
            {unit ? ` ${unit}` : ""}
          </span>
          {done && <I.check className="inline w-4 h-4 ml-1 -mt-0.5 text-green" aria-label="done" />}
        </span>
      </div>
      <div className="mt-1.5 h-[3px] bg-line">
        <div className="h-full origin-left transition-transform duration-700 ease-out-strong" style={{ background: color, transform: `scaleX(${pct})` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated number                                                      */
/* ------------------------------------------------------------------ */

export function AnimatedNumber({ value, className, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, format);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, value, { duration: 0.8, ease: [0.23, 1, 0.32, 1] });
    return () => c.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref} className={cn("tabular-nums", className)}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ */
/* Tabs: text with an ink underline that slides between options          */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: string; icon?: Icon; ariaLabel?: string }[];
  className?: string;
  label?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-end gap-5", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        const IconC = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel ?? o.label}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(o.value)}
            className={cn("relative inline-flex items-center gap-1.5 h-9 t-subhead whitespace-nowrap transition-colors", active ? "text-ink font-semibold" : "text-ink-2 hover:text-ink")}
          >
            {IconC && <IconC className="w-4.5 h-4.5" aria-hidden />}
            {o.label}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink" transition={springFast} />}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                               */
/* ------------------------------------------------------------------ */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: checked ? "var(--c-ink)" : "var(--c-surface-2)", boxShadow: checked ? undefined : "inset 0 0 0 1px var(--c-line)" }}
    >
      <motion.span className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.25)]" style={{ background: checked ? "var(--c-on-ink)" : "var(--c-surface)" }} animate={{ x: checked ? 20 : 0 }} transition={springFast} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ruled lists                                                          */
/* ------------------------------------------------------------------ */

interface RowProps {
  icon?: Icon;
  color?: ColorKey;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  to?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function Row({ icon: IconC, color, leading, title, subtitle, trailing, chevron, to, onClick, destructive, disabled }: RowProps) {
  const body = (
    <>
      {leading ?? (IconC && <IconC className="w-5 h-5 shrink-0" style={{ color: color && color !== "gray" ? colorVar(color) : "var(--c-ink-2)" }} aria-hidden />)}
      <span className="flex-1 min-w-0 py-3.5">
        <span className={cn("block t-body truncate", destructive ? "text-accent" : "text-ink")}>{title}</span>
        {subtitle && <span className="block t-footnote text-ink-2 truncate">{subtitle}</span>}
      </span>
      {trailing}
      {chevron && <I.arrow className="w-4 h-4 text-ink-2 shrink-0 transition-transform group-hover/row:translate-x-0.5" aria-hidden />}
    </>
  );
  const interactive = (to || onClick) && !disabled;
  const cls = cn("group/row flex items-center gap-3.5 px-1 min-h-14 text-left w-full focus-visible:outline-offset-[-2px]", interactive && "hoverable", disabled && "opacity-40 pointer-events-none");
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

export function Group({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {header && <h3 className="t-title2 text-ink mb-2">{header}</h3>}
      <div className="grouped">{children}</div>
      {footer && <p className="t-footnote text-ink-2 mt-2">{footer}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page header                                                          */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-4">
        <div className="min-w-0">
          <h1 className="t-large text-ink">{title}</h1>
          {subtitle && <p className="t-body text-ink-2 mt-2 max-w-[62ch]">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="rule-double" />
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Menu (portal, keyboard navigable)                                     */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  label: string;
  icon: Icon;
  onSelect: () => void;
  destructive?: boolean;
}

export function Menu({ items, label = "More", align = "right" }: { items: MenuItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const height = 44 * items.length;
    const top = r.bottom + 6 + height > window.innerHeight ? Math.max(8, r.top - 6 - height) : r.bottom + 6;
    setPos(align === "right" ? { top, right: window.innerWidth - r.right } : { top, left: r.left });
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    place();
    requestAnimationFrame(() => itemRefs.current[0]?.focus());
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(idx + d + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") close(false);
  };

  return (
    <div
      className="relative"
      onClick={(e) => {
        // Menus sit on clickable cards: a menu click must never open the card.
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button ref={trigger} type="button" onClick={() => setOpen((o) => !o)} aria-label={label} aria-haspopup="menu" aria-expanded={open} className="btn w-8 h-8 text-ink-2 hover:text-ink hover:bg-fill-2">
        <I.more className="w-5 h-5" aria-hidden />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menu}
              role="menu"
              aria-label={label}
              onKeyDown={onKey}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={springFast}
              style={{ position: "fixed", top: pos.top, left: pos.left, right: pos.right }}
              className="z-95 w-56 rounded-md float py-1 text-ink"
            >
              {items.map(({ label: l, icon: IconC, onSelect, destructive }, i) => (
                <button
                  key={l}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    onSelect();
                  }}
                  className={cn("w-full flex items-center gap-3 px-3.5 h-10 t-subhead text-left outline-none hover:bg-fill focus-visible:bg-fill active:bg-fill-2", destructive ? "text-accent" : "text-ink")}
                >
                  <IconC className="w-4.5 h-4.5 shrink-0 opacity-80" aria-hidden />
                  {l}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                               */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    requestAnimationFrame(() => {
      const auto = panel.current?.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      (auto ?? focusables()[1] ?? focusables()[0])?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-90 grid place-items-end sm:place-items-center">
          <motion.div className="absolute inset-0 bg-[#1b1813]/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.18 } }}
            transition={spring}
            className={cn("relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto float rounded-t-xl sm:rounded-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]", className)}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              {title && (
                <h2 id={titleId} className="t-title2 text-ink">
                  {title}
                </h2>
              )}
              <IconButton icon={I.x} label="Close" onClick={onClose} className="-mr-2 -mt-1 w-8 h-8 ml-auto" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                 */
/* ------------------------------------------------------------------ */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-[4px] border border-line bg-surface t-caption font-semibold text-ink-2 font-sans">{children}</kbd>;
}

export function EmptyState({ icon: IconC, title, body, action }: { icon: Icon; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="text-center py-16 px-6 max-w-md mx-auto">
      <IconC className="w-10 h-10 mx-auto text-ink-3" aria-hidden />
      <h3 className="t-title1 text-ink mt-4">{title}</h3>
      <p className="t-body text-ink-2 mt-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

/** Pure CSS spinner: keeps turning even when the main thread is busy. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return <span role="status" aria-label="Loading" className={cn("inline-block rounded-full border-2 border-current border-r-transparent shrink-0", className)} style={{ width: size, height: size, animation: "spin 0.7s linear infinite" }} />;
}

export function PageSpinner() {
  return (
    <div className="grid place-items-center py-32 text-ink-2">
      <Spinner size={24} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stepper                                                              */
/* ------------------------------------------------------------------ */

export function Stepper({ value, onChange, min = 0, max, step = 1, label, disabled }: { value: number; onChange: (v: number) => void; min?: number; max: number; step?: number; label: string; disabled?: boolean }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-md h-8 shadow-[inset_0_0_0_1px_var(--c-line)] bg-surface", disabled && "opacity-40 pointer-events-none")}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => set(value - step)} className="w-9 h-full grid place-items-center rounded-l-md text-ink hover:bg-fill active:bg-fill-2 disabled:opacity-30 disabled:cursor-not-allowed">
        <I.minus className="w-3.5 h-3.5" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-9 text-center t-subhead t-num text-ink border-x border-line leading-8">
        {value}
      </output>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(value + step)} className="w-9 h-full grid place-items-center rounded-r-md text-ink hover:bg-fill active:bg-fill-2 disabled:opacity-30 disabled:cursor-not-allowed">
        <I.plus className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
