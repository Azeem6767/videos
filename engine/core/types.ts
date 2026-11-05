// engine/core/types.ts — shared types + output formats (README §8)
export type V3 = [number, number, number];

export type Cam = { pos: V3; look: V3; fov: number; roll?: number };

export type Format = { w: number; h: number; fps: number };
export const FORMATS = {
  shorts: { w: 1080, h: 1920, fps: 30 }, // YouTube Shorts: 1080x1920, ~60 s
  long: { w: 1920, h: 1080, fps: 30 }, // long-form: 1920x1080, several minutes
} as const;
export type FormatName = keyof typeof FORMATS;

export { FPS } from "./util";

// A shot: a contiguous time window with one light preset and one camera rig.
export type Shot = {
  id: number;
  from: number; // seconds (from words.json / srt)
  to: number; // seconds
  light: "day" | "golden";
  name?: string;
};
