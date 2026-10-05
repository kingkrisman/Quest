import { useSyncExternalStore } from "react";
import { SEED_DECKS } from "./seed";
import type { ColorKey, DeckIconKey, I } from "../components/icons";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** One study item. Works as a flashcard (prompt/answer) and as a quiz question (options). */
export interface Item {
  id: string;
  prompt: string;
  answer: string;
  /** Optional multiple-choice options. When present, options[correctIndex] === answer. */
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  timeLimit?: number;
  points?: number;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  icon: DeckIconKey;
  color: ColorKey;
  items: Item[];
  createdAt: number;
  updatedAt: number;
  lastStudiedAt?: number;
  starred?: boolean;
  /** Set when the deck was generated from a scanned document. */
  source?: { name: string; pages: number; words: number };
  /** Time limit for Exam mode; defaults to about a minute per question. */
  examMinutes?: number;
}

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface CardState {
  ease: number;
  interval: number; // days
  due: number; // epoch ms
  reps: number;
  lapses: number;
  seen: number;
  correct: number;
}

export interface DayActivity {
  xp: number;
  answered: number;
  correct: number;
  focusMinutes: number;
}

export type StudyMode = "cards" | "learn" | "match" | "test" | "exam" | "review" | "focus";

export interface SessionLog {
  id: string;
  deckId?: string;
  deckTitle?: string;
  mode: StudyMode;
  at: number;
  correct: number;
  total: number;
  durationMs: number;
  xp: number;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  sound: boolean;
  haptics: boolean;
  dailyGoal: number; // xp
  focusMinutes: number;
  breakMinutes: number;
}

export interface Profile {
  id: string;
  name: string;
  color: ColorKey;
}

export interface State {
  version: 1;
  profile: Profile;
  decks: Deck[];
  cards: Record<string, CardState>;
  activity: Record<string, DayActivity>;
  sessions: SessionLog[];
  xp: number;
  achievements: Record<string, number>;
  settings: Settings;
  bestMatchMs: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export const dayKey = (d: Date | number = new Date()) => {
  const date = typeof d === "number" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const DAY = 86_400_000;

const ADJECTIVES = ["Curious", "Brave", "Clever", "Swift", "Calm", "Bright", "Bold", "Witty", "Keen", "Lucky"];
const ANIMALS = ["Otter", "Fox", "Owl", "Panda", "Tiger", "Koala", "Penguin", "Dolphin", "Lion", "Falcon"];
const PROFILE_COLORS: ColorKey[] = ["blue", "indigo", "purple", "pink", "orange", "green", "teal"];
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

function freshProfile(): Profile {
  return { id: uid(), name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(PROFILE_COLORS) };
}

/* Older saves stored an emoji + hue; map them onto an icon + system color. */
const EMOJI_ICON: Record<string, DeckIconKey> = { "🌍": "globe", "🧬": "biology", "💻": "code", "🧪": "science", "🧠": "idea", "💡": "idea", "📐": "math", "🎨": "art", "⚛️": "physics", "📜": "history", "🎵": "music", "🏛️": "civics", "🩺": "health", "⚖️": "law", "📊": "data", "🗣️": "speech", "🚀": "rocket" };
const HUE_COLORS: [number, ColorKey][] = [[0, "red"], [25, "orange"], [50, "yellow"], [130, "green"], [170, "mint"], [195, "teal"], [215, "blue"], [245, "indigo"], [280, "purple"], [330, "pink"], [360, "red"]];
const hueToColor = (h = 210): ColorKey => HUE_COLORS.reduce((best, cur) => (Math.abs(cur[0] - h) < Math.abs(best[0] - h) ? cur : best))[1];

type LegacyDeck = Deck & { emoji?: string; hue?: number };
type LegacyProfile = Profile & { emoji?: string; hue?: number };

function migrate(s: State): State {
  return {
    ...s,
    profile: { ...s.profile, color: s.profile.color ?? hueToColor((s.profile as LegacyProfile).hue) },
    decks: s.decks.map((d) => {
      const legacy = d as LegacyDeck;
      if (d.icon && d.color) return d;
      const { emoji, hue, ...rest } = legacy;
      return { ...rest, icon: (emoji && EMOJI_ICON[emoji]) || "book", color: hueToColor(hue) };
    }),
  };
}

function freshState(): State {
  const now = Date.now();
  return {
    version: 1,
    profile: freshProfile(),
    decks: SEED_DECKS.map((d, i) => ({ ...d, createdAt: now - i * 1000, updatedAt: now - i * 1000 })),
    cards: {},
    activity: {},
    sessions: [],
    xp: 0,
    achievements: {},
    settings: { theme: "system", sound: true, haptics: true, dailyGoal: 50, focusMinutes: 25, breakMinutes: 5 },
    bestMatchMs: {},
  };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const KEY = "kawe:v1";
let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      const base = freshState();
      return migrate({
        ...base,
        ...parsed,
        settings: { ...base.settings, ...parsed.settings },
        profile: { ...base.profile, ...parsed.profile },
      });
    }
  } catch {
    /* corrupt or unavailable storage: start fresh */
  }
  return freshState();
}

type StorageErrorListener = () => void;
const storageErrorListeners = new Set<StorageErrorListener>();
export const onStorageError = (fn: StorageErrorListener) => {
  storageErrorListeners.add(fn);
  return () => {
    storageErrorListeners.delete(fn);
  };
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked: tell the user so nothing is lost silently.
      storageErrorListeners.forEach((l) => l());
    }
  }, 120);
}

// Save a brand-new guest right away so their id and name stay stable across reloads.
try {
  if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(state));
} catch {
  /* storage blocked */
}

function set(updater: (s: State) => State) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}

// Keep tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

/* ------------------------------------------------------------------ */
/* Levels, streaks, mastery                                            */
/* ------------------------------------------------------------------ */

/** Total XP needed to reach `level` (level 1 = 0 xp). */
export const xpForLevel = (level: number) => 50 * (level - 1) * level;

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, into: xp - floor, span: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

export function streakInfo(activity: Record<string, DayActivity>) {
  const active = (k: string) => (activity[k]?.xp ?? 0) > 0;
  let current = 0;
  let cursor = new Date();
  // A streak survives until the end of today even if today has no activity yet.
  if (!active(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY);
  while (active(dayKey(cursor))) {
    current++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  const keys = Object.keys(activity).filter(active).sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of keys) {
    const t = new Date(k + "T00:00:00").getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best: Math.max(best, current), activeToday: active(dayKey()) };
}

/** 0 = new, 1 = learning, 2 = familiar, 3 = mastered */
export function masteryOf(c: CardState | undefined): 0 | 1 | 2 | 3 {
  if (!c || c.seen === 0) return 0;
  if (c.interval >= 7) return 3;
  if (c.interval >= 2 || c.reps >= 2) return 2;
  return 1;
}

export function deckMastery(deck: Deck, cards: Record<string, CardState>) {
  const counts = [0, 0, 0, 0];
  for (const it of deck.items) counts[masteryOf(cards[it.id])]++;
  const total = deck.items.length || 1;
  const score = (counts[1] * 0.25 + counts[2] * 0.6 + counts[3]) / total;
  return { counts, percent: Math.round(score * 100) };
}

export function dueItems(s: State, deckId?: string) {
  const now = Date.now();
  const out: { deck: Deck; item: Item }[] = [];
  for (const deck of s.decks) {
    if (deckId && deck.id !== deckId) continue;
    for (const item of deck.items) {
      const c = s.cards[item.id];
      if (c && c.seen > 0 && c.due <= now) out.push({ deck, item });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof I;
  color: ColorKey;
  goal: number;
  progress: (s: State) => number;
}

const totalAnswered = (s: State) => Object.values(s.activity).reduce((a, d) => a + d.answered, 0);
const totalFocus = (s: State) => Object.values(s.activity).reduce((a, d) => a + d.focusMinutes, 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-steps", name: "First Steps", description: "Finish your first study session", icon: "walking", color: "green", goal: 1, progress: (s) => s.sessions.length },
  { id: "creator", name: "Creator", description: "Build your own deck", icon: "compose", color: "blue", goal: 1, progress: (s) => s.decks.filter((d) => !d.id.startsWith("seed-")).length },
  { id: "century", name: "Century", description: "Answer 100 questions", icon: "target", color: "red", goal: 100, progress: totalAnswered },
  { id: "scholar", name: "Scholar", description: "Answer 1,000 questions", icon: "cap", color: "indigo", goal: 1000, progress: totalAnswered },
  { id: "flawless", name: "Flawless", description: "Score 100% on a session of 5+", icon: "diamond", color: "teal", goal: 1, progress: (s) => s.sessions.filter((x) => x.total >= 5 && x.correct === x.total).length },
  { id: "on-fire", name: "On Fire", description: "Keep a 3-day streak", icon: "fire", color: "orange", goal: 3, progress: (s) => streakInfo(s.activity).best },
  { id: "unstoppable", name: "Unstoppable", description: "Keep a 14-day streak", icon: "bolt", color: "yellow", goal: 14, progress: (s) => streakInfo(s.activity).best },
  { id: "deep-focus", name: "Deep Focus", description: "Log 100 focus minutes", icon: "meditate", color: "mint", goal: 100, progress: totalFocus },
  { id: "master", name: "Master", description: "Master 25 cards", icon: "trophy", color: "yellow", goal: 25, progress: (s) => Object.values(s.cards).filter((c) => masteryOf(c) === 3).length },
  { id: "speedster", name: "Speedster", description: "Clear a Match game in under 30s", icon: "focus", color: "pink", goal: 1, progress: (s) => (Object.values(s.bestMatchMs).some((ms) => ms < 30_000) ? 1 : 0) },
  { id: "level-5", name: "Rising Star", description: "Reach level 5", icon: "sparkle", color: "purple", goal: 5, progress: (s) => levelInfo(s.xp).level },
  { id: "goal-getter", name: "Goal Getter", description: "Hit your daily goal 7 times", icon: "flag", color: "red", goal: 7, progress: (s) => Object.values(s.activity).filter((d) => d.xp >= s.settings.dailyGoal).length },
];

type AchievementListener = (a: AchievementDef) => void;
const achievementListeners = new Set<AchievementListener>();
export const onAchievement = (fn: AchievementListener) => {
  achievementListeners.add(fn);
  return () => {
    achievementListeners.delete(fn);
  };
};

function checkAchievements() {
  const unlocked: AchievementDef[] = [];
  const now = Date.now();
  const next = { ...state.achievements };
  for (const a of ACHIEVEMENTS) {
    if (!next[a.id] && a.progress(state) >= a.goal) {
      next[a.id] = now;
      unlocked.push(a);
    }
  }
  if (unlocked.length) {
    set((s) => ({ ...s, achievements: next }));
    unlocked.forEach((a) => achievementListeners.forEach((l) => l(a)));
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const DECK_COLORS: ColorKey[] = ["blue", "indigo", "purple", "pink", "red", "orange", "green", "teal"];

export const actions = {
  createDeck(input: Partial<Deck> & { title: string; items: Item[] }): Deck {
    const now = Date.now();
    const deck: Deck = {
      id: uid(),
      description: "",
      icon: "book",
      color: pick(DECK_COLORS),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    set((s) => ({ ...s, decks: [deck, ...s.decks] }));
    checkAchievements();
    return deck;
  },

  updateDeck(id: string, patch: Partial<Deck>) {
    set((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)),
    }));
  },

  deleteDeck(id: string): Deck | undefined {
    const deck = state.decks.find((d) => d.id === id);
    set((s) => ({ ...s, decks: s.decks.filter((d) => d.id !== id) }));
    return deck;
  },

  restoreDeck(deck: Deck) {
    set((s) => ({ ...s, decks: [deck, ...s.decks.filter((d) => d.id !== deck.id)] }));
  },

  duplicateDeck(id: string) {
    const src = state.decks.find((d) => d.id === id);
    if (!src) return;
    return actions.createDeck({
      ...src,
      id: undefined as unknown as string,
      title: `${src.title} (copy)`,
      items: src.items.map((it) => ({ ...it, id: uid() })),
      starred: false,
      lastStudiedAt: undefined,
    });
  },

  toggleStar(id: string) {
    set((s) => ({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d)) }));
  },

  /** Record one answer: updates the card schedule (SM-2 style), activity and XP. Returns XP earned. */
  answer(itemId: string, rating: Rating, opts: { bonus?: number } = {}): number {
    const now = Date.now();
    const prev = state.cards[itemId] ?? { ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, seen: 0, correct: 0 };
    const correct = rating >= 2;
    let { ease, interval, reps, lapses } = prev;

    if (rating === 1) {
      reps = 0;
      lapses += 1;
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      reps += 1;
      if (rating === 2) ease = Math.max(1.3, ease - 0.15);
      if (rating === 4) ease += 0.15;
      if (reps === 1) interval = rating === 4 ? 3 : 1;
      else if (reps === 2) interval = rating === 2 ? 2 : rating === 4 ? 7 : 4;
      else interval = Math.round(interval * ease * (rating === 2 ? 0.8 : rating === 4 ? 1.3 : 1));
    }
    // "Again" comes back in ~1 minute; everything else is scheduled in days.
    const due = rating === 1 ? now + 60_000 : now + interval * DAY;

    const xp = (correct ? 10 : 2) + (opts.bonus ?? 0);
    const k = dayKey();
    const day = state.activity[k] ?? { xp: 0, answered: 0, correct: 0, focusMinutes: 0 };

    set((s) => ({
      ...s,
      xp: s.xp + xp,
      cards: {
        ...s.cards,
        [itemId]: { ease, interval, due, reps, lapses, seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0) },
      },
      activity: {
        ...s.activity,
        [k]: { ...day, xp: day.xp + xp, answered: day.answered + 1, correct: day.correct + (correct ? 1 : 0) },
      },
    }));
    return xp;
  },

  addXp(amount: number) {
    const k = dayKey();
    const day = state.activity[k] ?? { xp: 0, answered: 0, correct: 0, focusMinutes: 0 };
    set((s) => ({ ...s, xp: s.xp + amount, activity: { ...s.activity, [k]: { ...day, xp: day.xp + amount } } }));
  },

  logFocus(minutes: number) {
    const k = dayKey();
    const day = state.activity[k] ?? { xp: 0, answered: 0, correct: 0, focusMinutes: 0 };
    const xp = minutes * 2;
    set((s) => ({
      ...s,
      xp: s.xp + xp,
      activity: { ...s.activity, [k]: { ...day, xp: day.xp + xp, focusMinutes: day.focusMinutes + minutes } },
    }));
    actions.logSession({ mode: "focus", correct: 0, total: 0, durationMs: minutes * 60_000, xp });
    return xp;
  },

  logSession(log: Omit<SessionLog, "id" | "at">) {
    const entry: SessionLog = { ...log, id: uid(), at: Date.now() };
    set((s) => ({
      ...s,
      sessions: [entry, ...s.sessions].slice(0, 500),
      decks: log.deckId ? s.decks.map((d) => (d.id === log.deckId ? { ...d, lastStudiedAt: entry.at } : d)) : s.decks,
    }));
    checkAchievements();
  },

  recordMatch(deckId: string, ms: number) {
    const best = state.bestMatchMs[deckId];
    const isBest = best === undefined || ms < best;
    if (isBest) set((s) => ({ ...s, bestMatchMs: { ...s.bestMatchMs, [deckId]: ms } }));
    return { isBest, previous: best };
  },

  resetDeckProgress(deckId: string) {
    const deck = state.decks.find((d) => d.id === deckId);
    if (!deck) return;
    const ids = new Set(deck.items.map((i) => i.id));
    set((s) => ({ ...s, cards: Object.fromEntries(Object.entries(s.cards).filter(([k]) => !ids.has(k))) }));
  },

  updateSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  updateProfile(patch: Partial<Profile>) {
    set((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  },

  exportData() {
    return JSON.stringify(state, null, 2);
  },

  importData(json: string) {
    const parsed = JSON.parse(json) as State;
    if (!parsed || !Array.isArray(parsed.decks)) throw new Error("That file isn't a KÀWÉ backup.");
    set(() => migrate({ ...freshState(), ...parsed }));
  },

  resetAll() {
    const profile = state.profile;
    set(() => ({ ...freshState(), profile }));
  },

  checkAchievements,
};
