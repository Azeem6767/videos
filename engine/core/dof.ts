// engine/core/dof.ts — per-shot depth of field table (depth.md §6.3, README §6.9).
// cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
// Reference: DOF on in ~1/3 of shots; when on, background sigma720 CU 4.2 / MS 4.0 /
// FS 2.7 / WS 1.9 -> disc radius at 1080p = 3 x sigma720.
import type { V3 } from "./types";

export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };

export const dofAt = (table: Dof[], f: number) => {
  let i = 0;
  while (i + 1 < table.length && f >= table[i + 1].f) i++;
  const d = table[i];
  const p = table[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

/** disc radius (px @1080p) for a shot type when DOF is on */
export const CINF: Record<"CU" | "MS" | "FS" | "WS", number> = { CU: 13, MS: 12, FS: 8, WS: 6 };
