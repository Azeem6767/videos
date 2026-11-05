// videos/test/story.ts — engine smoke-test clip (README §11 step 6: a 3-5 s test clip before any
// full video). NOT a published video: placeholder word timings (no voiceover yet), one captain on
// a deck over the ocean, day light, wide -> push-in -> close-up. Validates world, character,
// camera, post chain, captions in one render.
import { loadWords, type Words } from "../../engine/core/words";
import { buildShots } from "../../engine/core/shots";
import { push, type Key } from "../../engine/core/camera";
import { CINF, type Dof } from "../../engine/core/dof";
import { sec2frame } from "../../engine/core/words";
import { hh } from "../../engine/core/util";
import type { Story } from "../../engine/core/story";
import { CAPTAIN, CREW_A } from "../../engine/characters/outfits";
import type { Expr } from "../../engine/characters/face";
import wordsRaw from "./words.json";

const words: Words = loadWords(wordsRaw);

const shots = buildShots([
  { from: 0, to: 2.0, light: "day", name: "wide push" },
  { from: 2.0, to: words.duration, light: "day", name: "close-up" },
]);

// camera: hold a slow push-in on the wide, then a glide to a close-up at the cut (2 s)
const keys: Key[] = [
  { f: 0, s: (f) => ({ pos: push([0, 2.4, 9.5], [0, 1.5, 0], f, 0, 0.0022), look: [0, 1.5, 0], fov: 40 }) },
  { f: sec2frame(2.0), dur: 24, s: () => ({ pos: [0, 1.85, 3.1], look: [0, 1.55, 0], fov: 36 }) },
];

const dofs: Dof[] = [
  { f: 0, cInf: CINF.WS },
  { f: sec2frame(2.0), cInf: CINF.CU, focus: () => [0, 1.55, 0] },
];

/** expression per word moment; blinks every 0.5-2.3 s; expression swaps ~2 f before the word */
const exprAt = (t: number): Expr => (t > 2.7 ? "grin" : t > 1.1 ? "smile" : "neutral");
const blinkAt = (t: number, seed: number) => {
  const ph = (t * 1.7 + hh(seed, 1) * 2) % 2.3;
  return ph < 0.067 ? 0.5 : ph < 0.133 ? 1 : 0;
};

export const testStory: Story = {
  name: "test",
  format: "shorts",
  words,
  shots,
  keys,
  dofs,
  world: { water: true, cloudCount: 8 },
  actors: [
    { outfit: CAPTAIN, pos: [0, 0.3, 0], build: "adult", seed: 11 },
    { outfit: CREW_A, pos: [1.6, 0.3, -0.6], build: "adult", seed: 23 },
  ],
  pose: (i, { t }) => {
    const seed = i === 0 ? 11 : 23;
    const stroll = i === 1 ? Math.sin(t * 2.2) * 0.5 + 0.5 : 0;
    return {
      side: false,
      opts: {
        mode: "stand",
        expr: exprAt(t),
        blink: blinkAt(t, seed),
        phase: stroll * 0.25,
        look: i === 0 ? 0 : -1,
        seed,
      },
    };
  },
};
