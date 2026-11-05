# videos/pirate-map — first real scene (owner, 2026-11-03)

A pirate with its crew sailing over the ocean, ending in a sleek transition into a map the pirate
is looking at. This is the first video for the engine — NOT the ep1.txt wallet story.

## Files this folder needs (README §4)

| File | Status |
|---|---|
| `script.md` | ✅ draft below — owner to approve wording |
| `vo.mp3` + `vo.srt` | ❌ MISSING — owner records the voiceover (make_vo.py: edge-tts → vo.mp3 + .srt + _words.json) |
| `words.json` | ❌ MISSING — generated from the srt by step 3 of the pipeline (engine/core/words.ts) |
| `story.ts` | ❌ not built yet — waits for the approved shot plan (see PLAN.md), then "go" |
| `assets/` | ❌ sfx files (ding on the map reveal, whoosh on the transition, ambience bed) |

## script.md (draft, ~60 s short, original)

> [hook] @narrator Every sailor dreams of one thing. [beat] Not gold. Not glory. [pause] A map.
> [normal] @narrator This crew has sailed the whole sea... [beat] and all they found was this.
> [normal] @narrator A map with one big red X. [beat] Right where their own island should be.
> [reveal] @narrator Some treasures you don't dig up. [pause] [beat] You sail to.
> [outro] @narrator Subscribe for the next voyage.

Visual beats per README §5: open on the ship action in frame one; crew as frozen extras except on
word-cue windows; close-up of the captain studying the map (tricorn sits low, map = outlined prop
held by a dot hand); the map reveal is a cut with a whole-frame transition blur pulse (sigma 3.6-5
for 0.3-1 s, WhipBlur) — or a circle iris if it should read as looking through a lens; ending is a
simple subscribe line (never kings/countries/comment challenges).
