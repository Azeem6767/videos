// engine/characters/face.ts — face library (characters.md §2.5).
// u = 1% of head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u down,
// everything slid toward the facing side. No blush, no catchlights.
import { Pen, INK, WHITE, MOUTH, TONGUE } from "./pen";
import { taper } from "./blob";

export type Expr =
  | "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock"
  | "relief" | "relief_open" | "dazed" | "pained" | "smile" | "smile_closed" | "lick";

type EyeK = "dot" | "small" | "lid" | "happy" | "dash" | "squeeze" | "shock" | "spiral";
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: string }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-4, -4], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
};

/** blink: 0 open .. 1 shut (0.5 = half-lid) */
export const faceV2 = (
  p: Pen, cx: number, cy: number, W: number, expr: Expr, facing = 0, look = 0, blink = 0, brim = false
) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing, lw = 3.8 * u;
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy;
  for (const side of [-1, 1]) {
    const x = fx + side * ex, lx = x + look * 3 * u;
    const kind: EyeK = blink >= 1 ? "dash" : F.eye[(facing ? side === facing : side > 0) ? 1 : 0];
    if (blink > 0 && blink < 1 && kind !== "shock") {
      // half-lid: skin-coloured cover over the eye + lid line
      if (kind === "dot") p.ell(lx, ey - u, 7 * u, 6 * u, "#ffe2c2", 0);
      p.stroke([[x - 9 * u, ey - u * (1 - blink)], [x + 9 * u, ey - u * (1 - blink)]], lw);
      continue;
    }
    if (kind === "dot") p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0);
    else if (kind === "small") p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0);
    else if (kind === "lid") { p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); }
    else if (kind === "happy") p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw);
    else if (kind === "dash") p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw);
    else if (kind === "squeeze") p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw);
    else if (kind === "shock") { p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u); }
    else { const s: [number, number][] = []; for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]); p.stroke(s, 2.4 * u); }
    const [dI, dO] = F.brow, by = ey - (brim ? 17 : 20) * u; // under a brim the brows sit lower
    if (kind === "shock") p.arc(x, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x - side * 8.5 * u, by + dI * u], [x + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u, mw = 4 * u;
  const dmouth = (rx: number, ry: number, y: number, tongue = false) => { // open "D" with teeth band (+ tongue)
    p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
    p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, WHITE, 0, 0, 180));
    if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
    p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
  };
  switch (F.mouth) {
    case "dash": p.stroke([[mx - 5.5 * u, my], [mx + 5.5 * u, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(12 * u, 8 * u, my - u); break;
    case "laugh": dmouth(16 * u, 11 * u, my, true); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": p.ell(mx, my + 2 * u, 9 * u, 11 * u, MOUTH, 3.2 * u); break;
    case "wave": { const s: [number, number][] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u + i * 1.5 * u, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u, my - 4 * u], [mx + 12 * u, my - 4 * u], [mx + 11 * u, my + 4 * u], [mx - 11 * u, my + 4 * u]], WHITE, 3 * u);
      for (const k of [-1, 0, 1]) p.stroke([[mx + k * 6 * u, my - 4 * u], [mx + k * 6 * u, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
  }
  if (expr === "nervous") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};
