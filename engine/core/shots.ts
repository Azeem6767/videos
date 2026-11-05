// engine/core/shots.ts — the shot runner: which shot is on screen at frame f.
// Shots are windows in seconds (from the srt/words.json timeline). Every phrase gets
// its own picture; a new image or camera angle at least every 2 s, max 4 s (README §5).
import type { Shot } from "./types";
import { FPS } from "./util";

export const shotAt = (shots: Shot[], f: number): Shot => {
  const t = f / FPS;
  for (const s of shots) if (t >= s.from && t < s.to) return s;
  return t < (shots[0]?.from ?? 0) ? shots[0] : shots[shots.length - 1];
};

export type ShotPlanEntry = Omit<Shot, "id">;

/** assign ids and validate (gaps/overlaps are allowed only as cuts; warn on long shots) */
export function buildShots(plan: ShotPlanEntry[]): Shot[] {
  return plan.map((p, i) => {
    if (p.to - p.from > 4.5) console.warn(`shot ${i} (${p.name ?? ""}) is ${(p.to - p.from).toFixed(1)}s > 4s`);
    return { ...p, id: i };
  });
}
