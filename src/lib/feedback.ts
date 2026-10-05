import { getState } from "./store";

/* Tiny synthesized sound effects: no audio files, no network. */

let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  correct: () => {
    tone(660, 0, 0.12, "triangle");
    tone(990, 0.08, 0.2, "triangle");
  },
  wrong: () => {
    tone(220, 0, 0.18, "sawtooth", 0.04);
    tone(165, 0.1, 0.25, "sawtooth", 0.04);
  },
  flip: () => tone(1200, 0, 0.05, "sine", 0.03),
  tap: () => tone(880, 0, 0.04, "sine", 0.025),
  combo: () => {
    [784, 988, 1175].forEach((f, i) => tone(f, i * 0.06, 0.14, "triangle", 0.06));
  },
  complete: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, "triangle", 0.07));
  },
  levelUp: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.35, "square", 0.035));
  },
  tick: () => tone(1500, 0, 0.03, "square", 0.015),
};

export type SoundName = keyof typeof SOUNDS;

const HAPTICS: Partial<Record<SoundName, number | number[]>> = {
  correct: 12,
  wrong: [30, 40, 30],
  combo: [10, 30, 10],
  complete: [15, 40, 15, 40, 30],
  levelUp: [20, 50, 20, 50, 40],
  tap: 6,
};

export function feedback(name: SoundName) {
  const { sound, haptics } = getState().settings;
  if (sound) {
    try {
      SOUNDS[name]();
    } catch {
      /* audio unavailable */
    }
  }
  if (haptics && HAPTICS[name] !== undefined && "vibrate" in navigator) {
    try {
      navigator.vibrate(HAPTICS[name]!);
    } catch {
      /* not allowed */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Confetti: a single full-screen canvas, physics-based particles.     */
/* ------------------------------------------------------------------ */

// Apple system colors
const COLORS = ["#007aff", "#34c759", "#ff9500", "#ff2d55", "#af52de", "#ffcc00", "#5ac8fa"];

export function confetti(opts: { x?: number; y?: number; count?: number; spread?: number } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(canvas);
  const c = canvas.getContext("2d")!;
  c.scale(dpr, dpr);

  const ox = (opts.x ?? 0.5) * window.innerWidth;
  const oy = (opts.y ?? 0.6) * window.innerHeight;
  const spread = opts.spread ?? 70;
  const parts = Array.from({ length: opts.count ?? 140 }, () => {
    const angle = (-90 + (Math.random() - 0.5) * spread * 2) * (Math.PI / 180);
    const speed = 9 + Math.random() * 11;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0,
      circle: Math.random() < 0.25,
    };
  });

  let frame = 0;
  const step = () => {
    frame++;
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of parts) {
      p.life++;
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - p.life / 170);
      if (alpha <= 0 || p.y > window.innerHeight + 40) continue;
      alive++;
      c.save();
      c.globalAlpha = alpha;
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      if (p.circle) {
        c.beginPath();
        c.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        c.fill();
      } else {
        // Flutter: squash the width with rotation to fake 3D tumbling.
        c.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(Math.cos(p.rot * 2)), p.h);
      }
      c.restore();
    }
    if (alive > 0 && frame < 400) requestAnimationFrame(step);
    else canvas.remove();
  };
  requestAnimationFrame(step);
}

/** Two side cannons: for big moments. */
export function celebrate() {
  confetti({ x: 0.15, y: 0.75, count: 90, spread: 45 });
  setTimeout(() => confetti({ x: 0.85, y: 0.75, count: 90, spread: 45 }), 120);
  setTimeout(() => confetti({ x: 0.5, y: 0.55, count: 120, spread: 90 }), 260);
}
