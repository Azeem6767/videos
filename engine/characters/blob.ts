// engine/characters/blob.ts — superellipse "bean" contours (characters.md §2.2).
import type { P2 } from "./pen";
import { rad } from "../core/util";

/** deterministic per-character random in [0, 1) */
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);

export type Blob = {
  a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number;
};

/** superellipse "bean": separate crown/jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen), n per contour. */
export const blobPts = (cx: number, cy: number, B: Blob, n = 96): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.94, slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12,
 *  8% bulge to the facing side, tilt ±4° (3/4 views up to ±12°), 0.8% contour wobble */
export const headBlob = (seed: number, a = 118, facing = 0, threeQuarter = false): Blob => ({
  a,
  b: a * (0.94 + (threeQuarter ? 0.08 : 0.08) * (rnd(seed, 1) - 0.5)) * (threeQuarter ? 1.085 : 1),
  nTop: (threeQuarter ? 2.2 : 1.75) + 0.3 * (rnd(seed, 2) - 0.5),
  nBot: (threeQuarter ? 1.9 : 2.3) + 0.3 * (rnd(seed, 3) - 0.5),
  egg: (threeQuarter ? 0 : -0.12) + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)) * (threeQuarter ? 1.5 : 1),
  rot: rad((threeQuarter ? 12 : 8) * (rnd(seed, 7) - 0.5) * (facing || 1)),
  noise: 0.008,
  seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64° measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));

/** tapered stroke, thick end at a: brows, moustache halves */
export const taper = (p: import("./pen").Pen, a: P2, b: P2, wa: number, wb: number, col = "#241726") => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly(
    [
      [a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2],
      [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2],
      [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2],
      [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2],
    ],
    col, 0
  );
  p.dot(a[0], a[1], wa / 2, col);
  p.dot(b[0], b[1], wb / 2, col);
};
