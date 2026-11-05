// engine/audio/sfx.ts — sfx placement + mix helpers (README §6.11: pop/sting on shot changes with
// new text, whoosh on fast cuts, thud on impacts, ambience bed, bright ding on the reveal;
// volumes 0.3-0.6, each placed on a word timestamp from words.json).
import React from "react";
import { Audio, staticFile } from "remotion";
import { FPS } from "../core/util";
import type { Words } from "../core/words";

export type SfxHit = {
  at: number;        // seconds (a word timestamp or words.T event)
  file: string;      // path under public/, e.g. "sfx/ding.mp3"
  volume?: number;   // 0.3-0.6
};

/** resolve {eventName: file} against words.T, plus raw hits, into a sorted hit list */
export const hitsFromEvents = (words: Words, events: Record<string, string>, extra: SfxHit[] = []): SfxHit[] =>
  [
    ...Object.entries(events).map(([k, file]) => ({ at: words.T[k] ?? 0, file, volume: 0.5 })),
    ...extra,
  ].sort((a, b) => a.at - b.at);

/** renders one <Audio> per hit, trimmed to start at its frame (visuals sync to words, never fixed) */
export const Sfx: React.FC<{ hits: SfxHit[] }> = ({ hits }) => (
  <>
    {hits.map((h, i) => (
      <Audio key={i} src={staticFile(h.file)} startFrom={Math.max(0, Math.round(h.at * FPS))} volume={h.volume ?? 0.5} />
    ))}
  </>
);

/** ffmpeg mix command for scripts/assemble.sh: voiceover + delayed sfx over the assembled video.
 *  sfx lines are "file:seconds:volume". */
export const mixCommand = (video: string, vo: string, sfx: { file: string; at: number; volume: number }[], out: string): string => {
  const inputs: string[] = ["-i", video, "-i", vo];
  sfx.forEach((s) => { inputs.push("-i", s.file); });
  const parts: string[] = sfx.map((s, i) =>
    `[${i + 2}:a]adelay=${Math.round(s.at * 1000)}|${Math.round(s.at * 1000)},volume=${s.volume}[s${i}]`
  );
  parts.push("[1:a]volume=1[a1]");
  const n = sfx.length;
  parts.push(n
    ? `[a1]${sfx.map((_, i) => `[s${i}]`).join("")}amix=inputs=${n + 1}:duration=first:dropout_transition=0[aout]`
    : "[a1]anull[aout]");
  return `ffmpeg -y ${inputs.join(" ")} -filter_complex "${parts.join(";")}" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 160k -shortest ${out}`;
};
