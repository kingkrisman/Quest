/**
 * Motion presets. Critically damped springs by default (no overshoot);
 * bounce only where a gesture carried momentum or for rare celebrations.
 */
export const spring = { type: "spring", duration: 0.4, bounce: 0 } as const;
export const springFast = { type: "spring", duration: 0.28, bounce: 0 } as const;
export const springBouncy = { type: "spring", duration: 0.45, bounce: 0.22 } as const;
export const easeOut = [0.23, 1, 0.32, 1] as const;

/** Lists: short stagger, transform + opacity only. */
export const list = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.03 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
  },
};
