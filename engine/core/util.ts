// engine/core/util.ts
export const FPS = 30;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const smooth = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
/** deterministic hash -> [0,1) (blink timing, per-character seeds) */
export const hh = (seed: number, k: number) => {
  const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
