// engine/characters/body.ts — body construction (characters.md §2.6/§2.7).
// Adults 3.5 HH (head 1 : torso 1.1 : legs 1.4), stout 3.47, kid 2.85. Torso is a vertical bean,
// limbs single thin ink strokes, hands ink dots, arms hang OUTSIDE the bean. Poses are never
// perfectly symmetric: lean 3-8°, head tilt ±5°. Drawn on ones (cast.ts changes pose every frame).
import { Pen, INK, WHITE, SKINS, SH_CLOTH, SH_SKIN, SH_WHITE, mul, mix, shade } from "./pen";
import { Blob, blobPts, headBlob, thickAngle, rnd, taper } from "./blob";
import type { P2 } from "./pen";
import type { Outfit, Build } from "./outfits";
import { faceV2, type Expr } from "./face";
import { hatV2 } from "./hat";
import { rad } from "../core/util";

export const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.92 },
  kid: { a: 112, torso: 0.85, legs: 1.0, tw: 0.72 },
};

export type Mode = "march" | "stroll" | "stand" | "sit";

export type FrontOpts = {
  phase?: number; expr?: Expr; mode?: Mode; look?: number; blink?: number;
  lift?: number; tilt?: number; headTilt?: number;
  light?: number; facing?: -1 | 0 | 1; seed?: number;
};

export const bodyFrontV2 = (
  p: Pen, o: Outfit, { phase = 0, expr = "neutral", mode = "stand", look = 0, blink = 0, lift = 60, tilt = 0, headTilt = 0, light = rad(-135), facing = 0, seed = 1 }: FrontOpts
) => {
  const B = BUILD[o.build ?? "adult"], skin = o.skin ?? SKINS[0], two = Math.PI * 2;
  const H = headBlob(seed, B.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  // body bob: 3-7% of height, lowest at foot contact (motion.md §3)
  const bob = mode === "march" ? 20 * Math.cos(2 * two * phase) : mode === "stroll" ? 12 * Math.cos(2 * two * phase) : mode === "sit" ? 0 : 2 * Math.sin(2 * two * phase + seed);
  const sole = 975, torsoBot = sole - B.legs * HH + bob, chin = torsoBot - B.torso * HH, hc = chin - H.b;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.jacket, INK, 0.5), footCol = o.boots && o.boots !== INK ? mix(o.boots, INK, 0.3) : INK;
  const L = mode === "march" ? lift : mode === "stroll" ? lift * 0.45 : mode === "sit" ? lift * 0.3 : 0;
  // legs: single thin strokes, no knees, slight A-stance; feet = short outward strokes
  for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
    if (mode === "sit") {
      const hx = 300 + side * 15 * u, hy = torsoBot - 0.12 * HH;
      p.stroke([[hx, hy], [hx + side * 10 * u, hy + 0.55 * HH], [hx + side * 30 * u, sole - 4 * u]], 5.8 * u, legCol);
      p.stroke([[hx + side * 30 * u, sole - 4 * u], [hx + side * 46 * u, sole - 3 * u]], 7.5 * u, footCol);
      continue;
    }
    const up = Math.max(0, Math.sin(two * (phase + ph))) * L;
    const hx = 300 + side * 15 * u, hy = torsoBot - 0.12 * HH, fx = 300 + side * 22 * u, fy = sole - 4 * u - up;
    p.stroke([[hx, hy], [(hx + fx) / 2 + side * 1.5 * u, (hy + fy) / 2], [fx, fy]], 5.8 * u, legCol);
    p.stroke([[fx, fy], [fx + side * 16 * u, fy + 0.5 * u]], 7.5 * u, footCol);
  }
  p.rot = tilt ? [rad(tilt), 300, torsoBot] : null;
  // torso: bean, widest low, round bottom, top hidden under the head (no neck)
  const T: Blob = { a: (B.tw / 2) * W / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  // arms hang OUTSIDE the bean and come out from behind it
  const arm = (side: number, swing: number): P2[] => {
    const x = tcx + side * 0.85 * T.a, y = chin + 0.12 * HH, out = tcx + side * (1.12 * T.a + 4 * u);
    return [[x, y], [out, y + 0.48 * HH], [out + side * 3 * u + swing * 14 * u, y + 0.92 * HH - Math.abs(swing) * 8 * u]];
  };
  for (const [side, s] of [[-1, -sw], [1, sw]] as const) {
    const a = arm(side, s);
    p.stroke(a, 5.2 * u, armCol); p.dot(a[2][0], a[2][1], 5.5 * u);
  }
  p.shadedFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light, T.a, 0.55, 0.18);
  p.clip(tp, () => {
    if (o.belt) for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt, 5.5 * u, 1.8 * u);
    for (let i = 0; i < 4; i++) p.dot(tcx + 2 * u * facing, chin + 0.12 * HH + i * 0.2 * HH, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
    if (o.sash) p.band([[tcx - 1.2 * T.a, torsoBot - 0.32 * HH], [tcx + 1.2 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
  });
  if (o.moustache) { // handlebar: two tapered commas, total ~0.36 W
    for (const s of [-1, 1]) taper(p, [tcx + 0, hc + 0.16 * HH], [tcx + s * 18 * u, hc + 0.2 * HH], 5 * u, 1.5 * u, o.moustache);
  }
  p.rimLight(tp, mix(o.jacket, "#ffffff", 0.45), light, 2 * u);
  p.inkRing(tp, ow, thick);
  // head tilts around the chin; hat sits low; face last (brows may overlap a brim)
  p.rot = tilt || headTilt ? [rad(tilt + headTilt), 300, chin] : null;
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, skin === WHITE ? SH_WHITE : SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  hatV2(p, o, hp, H, 300, hc, light, seed);
  faceV2(p, 300, hc, W, expr, facing, look, blink, !!o.hat && o.hat !== "hair" && o.hat !== "bonnet");
  p.rot = null;
};

export type SideOpts = {
  phase?: number; expr?: Expr; mode?: Mode; blink?: number;
  stomp?: number; stride?: number; look?: number;
  light?: number; facing?: 1 | -1; seed?: number; headTilt?: number;
};

/** side view (characters.md §2.7): head asym +0.12 rot +3°, small nose tick, narrower bean torso,
 *  two thin leg strokes (far one darker), one swinging arm, feet forward. */
export const bodySide = (
  p: Pen, o: Outfit, { phase = 0, expr = "neutral", mode = "stand", blink = 0, stomp = 1, stride = 1, look = 0, light = rad(-90), facing = 1, seed = 1, headTilt = 3 }: SideOpts
) => {
  const B = BUILD[o.build ?? "adult"], skin = o.skin ?? SKINS[0], two = Math.PI * 2;
  const H = headBlob(seed, B.a, facing, true);
  H.asym = 0.12; H.rot = rad(3);
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const bob = mode === "march" ? 20 * Math.cos(2 * two * phase) : mode === "stroll" ? 12 * Math.cos(2 * two * phase) : 0;
  const sole = 975, torsoBot = sole - B.legs * HH + bob, chin = torsoBot - B.torso * HH;
  const lean = mode === "march" ? 4 + 3 * Math.cos(2 * two * phase) : mode === "stroll" ? 2 + 2 * Math.cos(2 * two * phase) : 1;
  const hx = 300 + lean * 6 * u, hy = torsoBot - 0.12 * HH; // hip
  const legCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), armCol = mix(o.jacket, INK, 0.5);
  const legLen = B.legs * HH * 0.96;
  // legs: swing ±, stance foot stays planted (stride tied to speed via `stride`)
  for (const [side, ph, col] of [[1, 0, legCol], [-1, 0.5, farCol]] as const) {
    const q = two * (phase + ph);
    const lift = Math.max(0, Math.sin(q)) * (mode === "march" ? 60 * u * stomp : 30 * u * stomp);
    const fx = hx + Math.sin(q) * stride * legLen * 0.42 * stomp * facing, fy = sole - 4 * u - lift;
    p.stroke([[hx, hy], [hx + (fx - hx) * 0.5 + facing * 2 * u, (hy + fy) / 2], [fx, fy]], 5.8 * u, col);
    p.stroke([[fx, fy], [fx + facing * 16 * u, fy + 0.5 * u]], 7.5 * u, o.boots && o.boots !== INK ? mix(o.boots, INK, 0.3) : INK);
  }
  p.rot = [rad(lean * facing), hx, torsoBot];
  // torso bean, narrower in side view
  const T: Blob = { a: 0.31 * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: 0.1, asym: 0.06 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = hx + facing * 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  // arm: one stroke swinging ±30°, dot hand
  const sw = mode === "march" || mode === "stroll" ? Math.sin(two * phase) : 0;
  const ax = tcx + facing * 0.2 * T.a, ay = chin + 0.1 * HH;
  const hxp = ax + facing * (0.35 * HH) * Math.cos(sw * 0.5) * 1, hyp = ay + 0.95 * HH * 0.5 + Math.abs(sw) * 8 * u;
  const armEnd: P2 = [ax + facing * 0.3 * HH + sw * 30 * u, ay + 0.95 * HH];
  p.stroke([[ax, ay], [(ax + armEnd[0]) / 2, (ay + armEnd[1]) / 2], armEnd], 5.2 * u, armCol);
  p.dot(armEnd[0], armEnd[1], 5.5 * u);
  p.shadedFill(tp, o.jacket, mul(o.jacket, SH_CLOTH), light, T.a, 0.55, 0.18);
  p.clip(tp, () => {
    if (o.sash) p.band([[tcx - 1.2 * T.a, torsoBot - 0.32 * HH], [tcx + 1.2 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    for (let i = 0; i < 3; i++) p.dot(tcx + facing * 2 * u, chin + 0.15 * HH + i * 0.2 * HH, 2.2 * u, o.buttons ?? shade(o.jacket, 0.7));
  });
  p.inkRing(tp, 5 * u, thickAngle(light));
  // head
  const headCx = hx + facing * lean * 4 * u + facing * 6 * u;
  const hcy = chin - H.b;
  p.rot = [rad(lean * facing + headTilt * facing), 300, chin];
  const hp = blobPts(headCx, hcy, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, 5 * u, thickAngle(light));
  // side face: one eye at +27u, brow taper, mouth dash, optional nose tick (3/4 view only)
  const ex = headCx + facing * 27 * u, ey = hcy;
  const kind = blink >= 1 ? "dash" : expr === "shock" ? "shock" : expr === "grin" || expr === "laugh" || expr === "relief" ? "happy" : "lid";
  if (kind === "shock") { p.ell(ex, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(ex + look * 3 * u, ey + 1.5 * u, 3 * u); }
  else if (kind === "happy") p.arc(ex, ey + 3 * u, 8 * u, 6 * u, 200, 340, 3.8 * u);
  else if (kind === "dash") p.stroke([[ex - 8.5 * u, ey], [ex + 8.5 * u, ey]], 3.8 * u);
  else { p.ell(ex, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[ex - 9 * u, ey - u], [ex + 9 * u, ey - u]], 3.8 * u); }
  taper(p, [ex - 7 * u, ey - 20 * u], [ex + 8 * u, ey - 21 * u], 5 * u, 2.5 * u);
  p.stroke([[headCx + facing * 26 * u, hcy + 21 * u], [headCx + facing * 36 * u, hcy + 20 * u]], 4 * u);
  { const nx = headCx + facing * 44 * u; p.stroke([[nx, hcy + 4 * u], [nx + facing * 3 * u, hcy + 9 * u], [nx - facing * u, hcy + 10 * u]], 3 * u); }
  p.rot = null;
};
