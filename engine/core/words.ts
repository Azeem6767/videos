// engine/core/words.ts — words.json / srt loader (README §5 step 3).
// make_vo.py emits a bare array of {word, start, end} (seconds). The engine also
// accepts { words: [...], T: {eventName: seconds} } so videos can flag key moments.
import { FPS } from "./types";

export type WordTiming = { word: string; start: number; end: number };
export type Words = {
  words: WordTiming[];
  T: Record<string, number>; // named events in seconds
  duration: number; // seconds, incl. a small tail after the last word
};

export function loadWords(raw: unknown): Words {
  let words: WordTiming[] = [];
  let T: Record<string, number> = {};
  if (Array.isArray(raw)) {
    words = raw as WordTiming[];
  } else if (raw && typeof raw === "object" && Array.isArray((raw as any).words)) {
    words = (raw as any).words;
    T = (raw as any).T ?? {};
  } else {
    throw new Error("words.json: expected an array of {word,start,end} or {words, T}");
  }
  for (const w of words) {
    if (typeof w.word !== "string" || !(w.start <= w.end)) {
      throw new Error(`words.json: bad entry ${JSON.stringify(w)}`);
    }
  }
  words.sort((a, b) => a.start - b.start);
  const duration = words.length ? words[words.length - 1].end + 0.8 : 0;
  return { words, T, duration };
}

/** index of the word being spoken at time t (or -1 in a gap) */
export function wordIndexAt(w: Words, t: number): number {
  // binary search on start
  let lo = 0, hi = w.words.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (w.words[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans >= 0 && t < w.words[ans].end) return ans;
  // inside a gap: show the upcoming word only very close to it, else none
  if (ans + 1 < w.words.length && t >= w.words[ans + 1].start - 0.02) return ans + 1;
  return -1;
}

export const wordAt = (w: Words, t: number): WordTiming | null => {
  const i = wordIndexAt(w, t);
  return i >= 0 ? w.words[i] : null;
};

/** frame range helpers (README: visuals sync to words, never a fixed timeline) */
export const sec2frame = (s: number) => Math.round(s * FPS);
export const frame2sec = (f: number) => f / FPS;

/** minimal srt parser, used when only an .srt exists */
export function parseSrt(text: string): WordTiming[] {
  const out: WordTiming[] = [];
  const re = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/;
  for (const block of text.split(/\n\s*\n/)) {
    const m = block.match(re);
    if (!m) continue;
    const toS = (h: string, mi: string, s: string, ms: string) =>
      +h * 3600 + +mi * 60 + +s + +ms / 1000;
    const lines = block.split("\n");
    const word = lines.slice(lines.findIndex((l) => l.includes("-->")) + 1).join(" ").trim();
    out.push({ word, start: toS(m[1], m[2], m[3], m[4]), end: toS(m[5], m[6], m[7], m[8]) });
  }
  return out;
}
