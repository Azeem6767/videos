// engine/core/story.ts — the story schema: one video = words + shots + camera keys + DOF table
// + cast + pose function (README §4/§5). A video's videos/<name>/story.ts fills this in.
import type { Shot, Cam, FormatName } from "./types";
import type { Key } from "./camera";
import type { Dof } from "./dof";
import type { Words } from "./words";
import type { Outfit, Build } from "../characters/outfits";
import type { FrontOpts, SideOpts } from "../characters/body";
import type { SfxHit } from "../audio/sfx";

export type ActorSpec = {
  outfit: Outfit;
  pos: [number, number, number];
  build?: Build;
  seed?: number;
};

export type SceneCtx = {
  f: number;            // absolute frame
  t: number;            // seconds
  shot: Shot;
  cam: Cam;
  prevCam: Cam | null;
  light: "day" | "golden";
};

export type PoseFn = (actorIndex: number, ctx: SceneCtx) => { opts: FrontOpts | SideOpts; side: boolean };

export type Story = {
  name: string;
  format: FormatName;
  words: Words;
  shots: Shot[];        // windows in seconds, from the srt/words timeline
  keys: Key[];          // camera keys, absolute frames
  dofs: Dof[];          // per-shot DOF table (dof.ts)
  kicks?: [number, number][]; // impact kicks [timeSec, gain]
  actors: ActorSpec[];
  pose: PoseFn;         // per-frame pose per actor (drawn on ones)
  sfx?: SfxHit[];
  world?: { water?: boolean; groundColor?: string; cloudCount?: number };
};
