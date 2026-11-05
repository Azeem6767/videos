// engine/characters/hat.ts — hats (characters.md §2.9 + hatV2). Hats sit low (cover the top
// 25-40% of the head), follow the skull with a shallow "smile" curve, tilt with the head,
// carry the 0.85x outline, and must be lighter than black so the plum outline reads.
import { Pen, shade } from "./pen";
import { Blob, rnd, rotPts } from "./blob";
import type { P2 } from "./pen";
import type { Outfit } from "./outfits";

export const hatV2 = (
  p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number
) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const hat = o.hat;
  if (!hat || hat === "hair" || hat === "bonnet") {
    if (hat === "hair" || hat === "bonnet") {
      const cut = crown + (hat === "hair" ? 0.42 : 0.3) * HH;
      const dome = hp.filter(([, y]) => y < cut).map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
      if (hat === "hair") {
        const [x0, y0] = dome[dome.length - 1], [x1] = dome[0];
        for (let i = 1; i < 6; i++) dome.push([x0 + ((x1 - x0) * i) / 6, y0 + (i % 2 ? 4 * u : 0)]);
      }
      const col = hat === "hair" ? (o.hairColor ?? "#5a3b2a") : (o.capColor ?? "#c9a06a");
      p.shadedFill(dome, col, shade(col, 0.78), light, H.a);
      p.poly(dome, null, ow);
      if (hat === "bonnet") { // 7u brim band arc over the forehead + ribbon under the chin
        p.arc(cx, cut, 0.52 * W, 0.3 * HH, 200, 340, 7 * u);
        p.stroke([[cx - 0.2 * W, hc + 0.75 * HH], [cx + 0.2 * W, hc + 0.75 * HH]], 2 * u, "#b04a5a");
      }
    }
    return;
  }
  const a = H.rot + ((rnd(seed, 20) - 0.5) * 8 * Math.PI) / 180; // tilt with the head, ±4° extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  if (hat === "shako" || hat === "shako_tall") {
    const tall = hat === "shako_tall", yb = crown + 0.25 * HH, ht = (tall ? 0.66 : 0.56) * HH, wb = 46 * u, wt = 52 * u;
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    const body = R([...base.reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, "#3a3d47", "#24262d", light, wt);
    if (tall) p.clip(body, () => p.band(R([[cx - wt, yb - ht + 0.07 * HH], [cx + wt, yb - ht + 0.07 * HH]]), "#e8c45a", 0.06 * HH, 1.5 * u));
    p.poly(body, null, ow);
    const [px, py] = R([[cx, yb + 3 * u]])[0];
    p.ell(px, py, 34 * u, 0.045 * HH, "#16171b", 2.5 * u, 0, 180, (a * 180) / Math.PI);
    const [bx, by] = R([[cx, yb - 0.45 * ht]])[0];
    p.arc(bx, by, 6 * u, 5 * u, 200, 520, 2.4 * u, "#c9ccd2");
    const [tx, ty] = R([[cx, yb - ht - 6 * u]])[0];
    p.ell(tx, ty, 7 * u, 7 * u, "#2b7a4b", 2.5 * u);
  } else if (hat === "cap") {
    const cut = crown + 0.3 * HH;
    const dome = hp.filter(([, y]) => y < cut).map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    const col = o.capColor ?? "#e2453c";
    p.shadedFill(dome, col, shade(col, 0.78), light, H.a);
    p.poly(dome, null, ow);
    const s = rnd(seed, 21) < 0.5 ? -1 : 1, [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
    p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, (a * 180) / Math.PI);
  } else if (hat === "tophat") {
    const yb = crown + 0.22 * HH, wb = 0.31 * W * 0.5, ht = 0.8 * HH, brimW = 0.45 * W, brimH = 0.05 * HH;
    const body = R([[cx - wb, yb], [cx - wb * 0.92, yb - ht], [cx + wb * 0.92, yb - ht], [cx + wb, yb]]);
    const col = o.capColor ?? "#2e2a33";
    p.shadedFill(body, col, shade(col, 0.7), light, wb);
    p.poly(body, null, ow);
    p.clip(body, () => p.band(R([[cx - wb, yb - 0.12 * HH], [cx + wb, yb - 0.12 * HH]]), shade(col, 1.15), 0.09 * HH, 1.2 * u));
    p.ell(cx, yb + brimH / 2, brimW, brimH, shade(col, 0.85), ow, 0, 360, (a * 180) / Math.PI);
  } else if (hat === "tricorn") {
    // pirate hat: wide upturned brim (shallow smile) + low dome, gold trim
    const yb = crown + 0.3 * HH, bw = 0.62 * W, bh = 0.16 * HH, ht = 0.34 * HH;
    const col = o.capColor ?? "#3a3d47";
    // brim: shallow crescent, upturned at the sides
    const brim: P2[] = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; brim.push([cx + bw * (2 * t - 1), yb - bh * 0.55 * (1 - (2 * t - 1) ** 2) + bh * 0.55]); }
    for (let i = 16; i >= 0; i--) { const t = i / 16; brim.push([cx + bw * 0.82 * (2 * t - 1), yb - bh * 0.35 * (1 - (2 * t - 1) ** 2) + bh * 0.35 - 0.06 * HH]); }
    const bpts = R(brim);
    p.shadedFill(bpts, shade(col, 1.06), shade(col, 0.66), light, bw);
    p.poly(bpts, null, ow);
    // dome
    const dome: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; dome.push([cx - bw * 0.5 + bw * t, yb - 0.05 * HH + (bh * 0.4) * Math.sin(Math.PI * t)]); }
    for (let i = 12; i >= 0; i--) { const t = i / 12; dome.push([cx - bw * 0.5 + bw * t, yb - 0.05 * HH - ht + ht * Math.sin(Math.PI * t) * 0 + 0]); }
    // simpler dome: half-ellipse
    const d2: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; d2.push([cx - bw * 0.42 + bw * 0.84 * t, yb - 0.04 * HH - ht * Math.sin(Math.PI * t)]); }
    const dpts = R(d2);
    p.shadedFill(dpts, col, shade(col, 0.7), light, bw * 0.42);
    p.poly(dpts, null, ow);
    p.clip(dpts, () => p.band(R([[cx - bw * 0.4, yb - 0.04 * HH - 0.12 * HH], [cx + bw * 0.4, yb - 0.04 * HH - 0.12 * HH]]), "#e8c45a", 0.035 * HH, 1 * u));
  } else if (hat === "bandana") {
    const cut = crown + 0.34 * HH;
    const dome = hp.filter(([, y]) => y < cut).map(([x, y]) => [cx + (x - cx) * 1.04, hc + (y - hc) * 1.04] as P2);
    const col = o.capColor ?? "#c0353a";
    p.shadedFill(dome, col, shade(col, 0.72), light, H.a);
    p.poly(dome, null, ow);
    p.arc(cx, cut, 0.5 * W, 0.1 * HH, 190, 350, 4 * u, shade(col, 0.6)); // knot band
    const [kx, ky] = R([[cx + 0.42 * W, cut + 0.02 * HH]])[0];
    p.ell(kx, ky + 6 * u, 7 * u, 12 * u, shade(col, 0.8), ow * 0.7, 20); // knot tail
  }
};
