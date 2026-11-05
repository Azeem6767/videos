// engine/characters/pen.ts — Canvas2D pen + colour helpers (characters.md §3).
// Design canvas 600x1000, soles at y=975. All character art is drawn with this pen
// and cached as a texture per pose/expression/light (cast.ts).
export type P2 = [number, number];

export const INK = "#241726"; // dark plum outline, never pure black
export const WHITE = "#ffffff";
export const MOUTH = "#5a1e28";
export const TONGUE = "#e86e78";
export const SKINS = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
export const SH_SKIN: [number, number, number] = [0.96, 0.86, 0.84];
export const SH_WHITE: [number, number, number] = [0.92, 0.9, 0.96];
export const SH_CLOTH: [number, number, number] = [0.64, 0.66, 0.74];

export const mul = (c: string, m: [number, number, number]) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);

export class Pen {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** [radians, cx, cy]: rotate everything drawn after this is set (body lean / head tilt) */
  rot: [number, number, number] | null = null;
  constructor(g: CanvasRenderingContext2D, w = 600, h = 1000) {
    this.g = g; this.w = w; this.h = h;
  }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const [a, cx, cy] = this.rot;
    return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach(([x, y], i) => { const [X, Y] = this.P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    if (close) g.closePath();
  }
  poly(pts: P2[], fill: string | null, lw = 0, col = INK) {
    const g = this.g;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw > 0) { g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = "round"; g.stroke(); }
  }
  ell(x: number, y: number, rx: number, ry: number, fill: string | null, lw = 0, a0 = 0, a1 = 360, rotDeg = 0, col = INK) {
    const g = this.g;
    const [X, Y] = this.P(x, y);
    g.beginPath();
    g.ellipse(X, Y, Math.max(0.01, rx), Math.max(0.01, ry), (rotDeg * Math.PI) / 180, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw > 0) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
  }
  dot(x: number, y: number, r: number, col = INK) {
    const g = this.g;
    const [X, Y] = this.P(x, y);
    g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  }
  stroke(pts: P2[], w: number, col = INK) {
    const g = this.g;
    g.beginPath();
    pts.forEach(([x, y], i) => { const [X, Y] = this.P(x, y); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
  }
  /** elliptical arc stroke, angles in degrees (canvas: 0=+x, 90=+y down) */
  arc(x: number, y: number, rx: number, ry: number, a0: number, a1: number, w: number, col = INK) {
    const g = this.g;
    const [X, Y] = this.P(x, y);
    g.beginPath(); g.ellipse(X, Y, rx, ry, 0, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.stroke();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }

  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Fill the shape in the shadow colour, then a copy shifted toward the light in the base colour, blurred, clipped. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.3, soft = 0.09) {
    const g = this.g, m = g.getTransform(), k = Math.hypot(m.a, m.b);
    const dx = Math.cos(light) * shift * R, dy = Math.sin(light) * shift * R;
    this.clip(pts, () => {
      this.path(pts, true); g.fillStyle = shadow; g.fill();
      g.filter = `blur(${(soft * R * k).toFixed(1)}px)`;
      this.path(pts.map(([x, y]) => [x + dx, y + dy] as P2), true); g.fillStyle = base; g.fill();
      g.filter = "none";
    });
  }

  /** thick-thin ink ring: w(θ) = w0 (1 + k cos(θ − thick)), θ from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }

  /** flat strap with a thin ink rim (cross belts, sash, rifle parts) */
  band(pts: P2[], fill: string, w: number, rim: number) {
    const g = this.g; g.lineCap = "butt"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }

  /** optional thin light rim just inside the shadow-side edge */
  rimLight(pts: P2[], col: string, light: number, w: number, alpha = 0.55) {
    const g = this.g, dx = Math.cos(light) * w, dy = Math.sin(light) * w;
    this.clip(pts, () => {
      g.beginPath(); g.rect(-5000, -5000, 10000, 10000);
      pts.map(([x, y]) => this.P(x + dx, y + dy)).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath(); g.globalAlpha = alpha; g.fillStyle = col; g.fill("evenodd"); g.globalAlpha = 1;
    });
  }
}
