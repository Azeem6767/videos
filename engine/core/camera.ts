// engine/core/camera.ts — the camera grammar (motion.md §5.1, README §6.5).
// The camera glides, never snaps: symmetric smootherstep moves (~23 f: 10 in / 10 out,
// peak <= ~25 px/f at 720p). Big reframes are cuts. Holds keep a slow push-in.
// Impacts are 6-7 frame kicks that flip sign every frame. No hand-held float.
import type { Cam, V3 } from "./types";
import { FPS, clamp01 } from "./util";

export type Key = {
  f: number; // absolute frame
  dur?: number; // glide length in frames (default 24)
  cut?: boolean; // hard cut instead of a glide
  s: (f: number) => Partial<Cam> & { pos: V3; look: V3 };
};

/** symmetric smootherstep. Peak speed = 1.875 * distance / dur, so keep
 *  dur >= 0.075 * distance (in 720p px) to stay under ~25 px/f. */
export const glide = (u: number) => {
  const x = clamp01(u);
  return x * x * x * (x * (6 * x - 15) + 10);
};

export const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 4); // kept for cable physics

const full = (p: Partial<Cam> & { pos: V3; look: V3 }): Cam => ({
  fov: 40,
  roll: 0,
  ...p,
});

const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k],
  look: [a.look[0] + (b.look[0] - a.look[0]) * k, a.look[1] + (b.look[1] - a.look[1]) * k, a.look[2] + (b.look[2] - a.look[2]) * k],
  fov: a.fov + (b.fov - a.fov) * k,
  roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * k,
});

export const run = (keys: Key[], f: number): Cam => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};

/** slow dolly toward the look point; the subject grows ~rate per frame.
 *  Reference quiet frames: 0.14%/f median; punch words ~0.6%/f for ~35 f. */
export const push = (pos: V3, look: V3, f: number, f0: number, rate = 0.0025): V3 => {
  const k = Math.pow(1 - rate, Math.max(0, f - f0));
  return [
    look[0] + (pos[0] - look[0]) * k,
    look[1] + (pos[1] - look[1]) * k,
    look[2] + (pos[2] - look[2]) * k,
  ];
};

/** impact kick: image offset flips sign every frame, ~3 px at 720p per unit,
 *  gone in 7 frames, plus a small roll. t in seconds. */
export const kickAt = (t: number, kicks: [number, number][]): number => {
  let a = 0;
  for (const [t0, g] of kicks) {
    const n = Math.round((t - t0) * FPS);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * Math.pow(1 - n / 7, 1.5);
  }
  return a;
};

/** frame at which the current key's move has finished (for stable billboard views) */
export const keyEnd = (keys: Key[], f: number): number => {
  let e = 0;
  for (const k of keys) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

/** full camera for a frame: key rig + impact kick (README §6.5) */
export const camAt = (keys: Key[], f: number, t: number, kicks: [number, number][] = []): Cam => {
  const c = run(keys, f);
  const a = kickAt(t, kicks);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  const h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at look distance for 3 px
  return {
    ...c,
    look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m],
    roll: (c.roll ?? 0) + a * 0.004,
  };
};
