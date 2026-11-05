# Animation Engine (Remotion + three.js): how videos are made

**Status: design spec only. No engine code exists yet. Code starts only after the owner says "go".**

This file tells a human or a coding agent how a video is made with this engine and what it must look like. It is built from the owner's look-match study files (characters, depth, grade, lighting, motion, outlines, textures, CONTEXT) and the owner's earlier videos guide. Numbers come from those studies. Where two studies disagree, section 10 says so.

---

## 1. What this is

A reusable engine for animated stickman-style stories, made for:

- **YouTube Shorts**: 1080x1920 vertical, about 60 s.
- **Long-form videos**: 1920x1080 landscape, several minutes (see section 8: long-form was not studied, so its rules are extrapolated).

Every video is **standalone**: a viewer who has seen nothing else must understand it. Stories, characters and voice are the owner's own.

**Look in one paragraph.** Colourful, high-contrast, warmly lit 3D worlds with painted flat-colour textures and thin near-black ink lines on the geometry. Hand-drawn 2D characters (slightly egg-shaped heads, thin ink-stroke limbs) stand in that world as shaded billboards. Deep blurred backgrounds on chosen shots, haze in the distance, a warm lifted grade and a gentle vignette. The camera always glides, never snaps. Every spoken phrase gets its own picture. One caption word at a time.

**Originality rule.** The reference channel was studied privately, only to derive general rules and numbers. Never trace or copy its specific characters, props or shots. Never upload, publish or send any reference material anywhere.

---

## 2. Ground rules (how we work)

1. **No code until the owner says "go".** Reading, planning and writing docs is fine.
2. **Plan first, always.** For every video: a shot-list plan, then wait for approval, then build.
3. One video at a time. Ask at most one question when something is unclear.
4. If a needed file or asset is missing, say exactly which one. Do not guess or silently substitute.
5. Reuse the engine. Do not rewrite core modules to fit one video; add video-specific code under that video's folder.
6. Pace everything to the voiceover (mp3) and its word timings (srt/words.json). Visuals sync to words, never to a fixed timeline.
7. Never mention a model's knowledge limits or "last episode", kings, countries or comment challenges inside a video. Ending is a simple subscribe line.

---

## 3. Stack

Pin the versions already proven in the owner's bridge project:

| Piece | Version |
|---|---|
| Remotion | 4.0.290 |
| three | 0.175 |
| @react-three/fiber | 9.1.2 |
| @react-three/postprocessing | 3.0.4 |
| postprocessing | 6.37.2 |
| Output | 30 fps, 1080x1920 (Shorts) or 1920x1080 (long-form), h264 |

Other tools: ffmpeg for assembly and mixing; Python (numpy, PIL) only for helper scripts such as contact sheets and measurements. Do not install anything or download code without asking.

**Owner's machine:** a modest Linux PC (single core is the safe assumption). This drives the render rules in section 7.

---

## 4. Proposed layout (to confirm before coding)

```
engine/
  core/        story schema, SRT/words loader, shot runner, camera (CAMS) + light (LIGHTS) tables
  characters/  head/torso builders, face library, outfits, shading, sprite pool (cast)
  world/       sky shader, fog, lights, procedural paint textures, props, water, clouds
  post/        InkPass, ThinLensDOF, Bloom, ToneMapping, GradeEffect, WhipBlur
  captions/    one-word caption renderer
  audio/       sfx placement + mix helpers
videos/<name>/
  script.md, vo.mp3, words.json (+ .srt), story.ts, assets/
scripts/       contact-sheet preview, per-shot render, assemble + mix
```

The older Python engine (cc_core.py, hobo_signs.py, hobo_video.py) is left untouched. This is a separate engine.

---

## 5. Pipeline: how one video is made

| Step | Who | Output | Gate |
|---|---|---|---|
| 1. Idea and script | owner (+ assistant for idea batches) | `script.md`, about 1000 characters for 60 s | script approved |
| 2. Voiceover | owner (e.g. ElevenLabs) | `vo.mp3` + `.srt` | files received |
| 3. Word timings | assistant | `words.json`: every word with start/end, plus an event dict `T` for key moments | |
| 4. **Shot plan** | assistant | table per shot: start/end from the srt, what is on screen, camera move, transition, light (day/golden), DOF on/off, caption words, gag, sfx | **owner approves, then says "go"** |
| 5. Build | assistant | `story.ts` (timeline, cameras, lights, cast cues) | |
| 6. Contact-sheet preview | assistant | one low-res frame per shot | owner approves |
| 7. Render per shot | assistant | shot clips, then assembled | |
| 8. Mix and assemble | assistant | final mp4 (+ audio mix) | |
| 9. QA | assistant | section 9 checklist | |

**Shot plan rules**

- Average shot about 2 s, never longer than 4 s. A new image or camera angle at least every 2 s.
- Every phrase gets its own picture. Every joke line gets a literal visual gag (a sign, a prop, a reaction).
- Open on an action in the first frame, not a title. Strong hook line in the first second.
- Plant the odd object early with a close-up and pay it off at the end.
- Show the reveal step by step, then a visual burst, then a hard cut to the last line and a simple subscribe card.
- Acting beats (expression changes, hits) land **0-3 frames before** the word they belong to.

---

## 6. The look spec

Units: **px at 720x1280** unless stated. Multiply by 1.5 for 1080x1920. `W` = head width, `HH` = head height, `u` = 1% of W.

### 6.1 Characters (2D drawn, shown as camera-facing billboards)

Characters are drawn with Canvas2D on a design canvas (600x1000, soles at y=975) and placed in the 3D world as billboard planes. Textures are cached per pose, light and expression.

**Proportions**

| Build | Total height | Head : torso : legs | Torso width |
|---|---|---|---|
| Adult | **3.5 HH** | 1 : 1.1 : 1.4 | 0.80 W |
| Stout | 3.47 HH | 1 : 1.15 : 1.32 | 0.92 W, rounder belly |
| Kid | **2.85 HH** | 1 : 0.85 : 1.0 | 0.72 W (kid heads are almost adult-sized) |

**Head shape.** Not a perfect circle and not "less round". Use a superellipse bean:

| Param | Value | Per-character variation |
|---|---|---|
| H/W | 0.94 | ±0.04 |
| egg (chin taper) | -0.12 | ±0.03 |
| crown exponent n_top | 1.75 (slightly pointed) | ±0.15 |
| jaw exponent n_bot | 2.30 (fuller) | ±0.15 |
| asymmetry | +0.08 toward the facing side | 0.06-0.10 |
| tilt | ±4° random (3/4 views up to ±12° toward the facing side) | |
| contour wobble | 0.8% of radius, seeded | |

**Body**

- Torso is a vertical **bean** (round bottom, widest at 60-70% of its height), not a rounded box. The head overlaps the torso top, no neck.
- Legs: a single ink stroke, 0.058 W thick, slight curve, no knees. Arms: stroke 0.052 W. Hands: filled ink **dots** (about 0.11 W), no fingers. Feet: short strokes (0.16 W long, 0.075 W thick) pointing outward in front view.
- Arms hang **outside** the torso bean so they do not vanish behind it.
- Poses are never perfectly symmetric: lean 3-8°, head tilt about ±5°, one arm doing something while the other hangs.
- Hats sit low (cover the top 25-40% of the head), follow the skull with a shallow "smile" curve, tilt with the head and carry the same outline. Hat colours must be lighter than black so the outline still reads.
- Clothing detail: at most about 5 elements per torso (buttons, pocket, belt, tie, collar, stripes), flat fills with thin inner lines.

**Draw order:** legs and feet, back arm, torso (shaded fill, clothing clipped to torso, ink ring), front arm only if the hand is in front, head, hat, face last (so brows can overlap a brim).

**Shading on the card**

- Head: soft **crescent** on the side away from the light (shadow multiplier about 0.89 of lit), not a hard cel edge. Skin shadow tint x(0.96, 0.86, 0.84); pale heads shade lavender x(0.92, 0.90, 0.96).
- Torso: broader gradient from lit to shadow side (about 1.0 to 0.6), optional thin light rim inside the shadow edge.
- Faces must render **light**: luma at least 0.85 on screen.
- No blush, no eye catchlights, no grain on faces.

**Skin fills:** `#ffe2c2`, `#f5c9a0`, `#ecd0b6`, `#c99067`. Pale "townsfolk" head `#fbf8f4`.

### 6.2 Outline (character ink)

- Colour: dark **plum `#241726`**, never pure black (it must stay about `#2a1b28` or lighter on screen).
- Width: 5% of W. **Thick-thin:** `w(θ) = w0 · (1 + 0.45 · cos(θ − θthick))`, about 3:1 between thickest and thinnest. Thickest on the bottom / shadow side (about 64° canvas angle for upper-left light), moves with the light.
- Hats and props: 0.85x the main width. Inner detail lines (brows, mouth): 0.6-0.9x. Clothing seams: about 0.4x.

### 6.3 Faces

Features sit at: eye spacing **0.26 W** centre to centre, eyes at head centre height, brows at about y = -0.20 W, mouth at about y = +0.19 W. All features slide **0.07-0.08 W toward the facing side**. No nose in front view (a small nose tick in 3/4 view only), no ears.

| Expression | Eyes | Brows | Mouth |
|---|---|---|---|
| neutral (default) | **lidded half-disc** (deadpan) | nearly flat | short tilted dash (smirk) |
| stern | lidded | V shape | frown arc |
| grin | happy arcs | raised | open D with white teeth band |
| laugh | squeezed > < | raised high | open D with tongue |
| nervous | small ovals | worried | wavy line + sweat drop |
| shock | **white circles about 0.22 W, almost touching**, tiny pupils | raised arcs | tall O |
| dazed | spirals | worried | small wave |
| pained | one squeezed, one lidded | worried | teeth box |

Brows: 0.17-0.18 W long, tapered, thick (about 0.05 W). Optional per-character quirk: the facing-side brow sits slightly higher (skeptical). Under a brimmed hat, brows drop a little.

### 6.4 Character animation

- **Drawn on ones.** A moving character changes pose every frame. No 2s or 3s holds, no line boil, no squash and stretch, no smears.
- **Standing figures do not idle.** Extras stay frozen except on cue windows taken from the word timings (cheer, wave, hop). Sitters may bob only if motivated (water).
- **Walks:** 9-12 frames per step (2.5-3.3 steps/s). Body bob 3-7% of height, lowest at foot contact. Lean cycles from about 1° (passing) to 5-7° (contact). **Stance feet stay planted** (no skating): tie stride length to speed.
- **Blinks:** every 0.5-2.3 s, 4 frames (half, shut, shut, half), plus a blink across every expression swap.
- **Expression swaps** happen about 2 frames before the word.
- **Impact action (example: hammer):** 4-frame wind-up, about 7 frames held at the top, a **1-frame strike** on the word onset, then a 4-5 frame burst effect.
- **Ground contact:** a soft contact blob under each standing card (about 0.5 W x 0.06 W, alpha 0.3, blurred). By day the cards do not cast shadows, only blobs (offset away from the sun, shade/lit about 0.52-0.74). At golden hour cards cast long soft shadows plus a blob.

### 6.5 Camera

**The camera glides. It does not snap.** The reference camera is almost never dead still (about 65% of frames move).

| Rule | Value |
|---|---|
| Move shape | symmetric ease-in-out (smootherstep): about **10 frames in, 10 out, about 23 total** |
| Peak speed | typically 14-16 px/f, **max about 25 px/f** at 720p (about 37 px/f at 1080p) |
| Big jumps (large travel or zoom) | **use a cut**, not a fast fly-through |
| Moves per 10 s | about 6 |
| Quiet frames | keep a slow **push-in**: 0.14-0.35 % per frame; punch words 0.6 % per frame for about 35 frames. Push-ins are more common than pull-outs |
| Hand-held float | **none** (delete it) |
| Roll | 4-8° glided over at least 18 frames; 2-3 roll shots per video at most, used on emphasis beats |
| Dutch tilt | about 2% of frames, roll at most 0.05 rad |
| Whip pan | rare (about 0.45 per minute), 45-93 px/f for 7-25 frames, **always with strong directional motion blur**. At most one per short, and only if the blur effect exists |
| Impact kick | 6-7 frames, offset flips sign **every frame**, about 3 px at 720p, roll ±0.1-0.35°. Stop the push-in at the hit |
| Crane pull-out | rare, slow (up to about 3-4.6 % per frame) |
| Transition blur | whole-frame blur pulse (sigma about 3.6-5) for 0.3-1 s at a few cuts. This is a transition effect, not DOF |

**Framing**

| Shot type | Head top at (fraction of frame height) |
|---|---|
| Close-up | 0.28 |
| Medium | 0.35 |
| Full | 0.38 |
| Wide | 0.50 |

Horizon at 0.40-0.50. FOV 34-46°. Camera height about 0.7-1.0 x character height (about 1.4-2.0 m above the ground): 82% eye level, few low shots, top-down rare. In about one third of medium and close shots, put a **foreground object** covering 10-25% of one frame edge, placed at 0.3-0.5 x the focus distance, so it blurs.

### 6.6 World, props and painted textures

The world is 3D (boxy, simple, readable) with **painted procedural textures**. Surfaces are a few flat colour fields.

- Painted lines (board gaps, mortar, tile joints): thin, **3-5 px at 1080p**, crisp. Gap core about 3.3% of the board pitch. Texture lines scale with perspective and blur with DOF (they are paint, not ink).
- Keep surfaces **light and saturated**: decks L* 61-74, stone/plaster L* 60-73, nothing darker than about L* 19. No pure black materials.
- No photographic grain. A gentle broad drift in colour is fine.
- Stone: light top bevel (about +5 L*), dark bottom (about -3). Avoid regular cobble grids (they read as polka dots); use flat slabs or dirt with pebble dabs.
- Details: small dark nails, rare knot rings, speckles 2-4 px, hairline cracks.
- **Water:** sparse crest and trough marks (about 0.3% area near, about 2.5% far), long thin glints, a gradient with distance. Not evenly spread streaks.
- **Clouds:** three tones (lit crown, mid, lavender underside) with a flat soft bottom, no dark rim.
  - Day: lit `#fbf8f1`, mid `#e1e5f3`, shade `#c3cbe9`.
  - Golden: lit `#ffd2a8`, mid `#f2a08f`, shade `#a98fc4`.
- **Metal/iron:** blue-grey with a painted bright band (about 25-30% of the area), mids `#586076` / `#8790a6`, darks `#282f41`. Specular highlights only on metal.
- Fill floors and props with small details (scattered paper, signs, crates, bunting) so no area is empty.

**Albedo targets for lit day surfaces**

| Hue | Hex |
|---|---|
| red | `#e85648` |
| orange / wood | `#e3b684` |
| yellow | `#d3c677` |
| green | `#7fbc4e` / `#5ab04c` |
| azure | `#93c6f9` |
| blue | `#7980b0` |

Dark materials are **coloured darks** at L* 16-22: navy `#262c51`, aubergine `#2e2439`, plum `#3d2530`, oxblood `#4d2725`. Wall/plaster examples: cream `#f3e6d2`, salmon `#e58e6e`, red `#df585d`, aqua `#a3cdc7`.

**Sky (4-stop gradient by elevation, degrees)**

| Light | Colours (horizon to top) | Elevation stops |
|---|---|---|
| Day | `#d8ecf7`, `#8ccbf8`, `#4aa3f2`, `#2a7fe6` | 3, 12, 30 |
| Golden | `#ffd08a`, `#ffad7e`, `#e9849a`, `#8c78c4` | 4, 14, 32 |

Day sky must be saturated (C* 40-89), not washed out. Golden sky goes through coral, pink and lilac, not grey-mauve.

### 6.7 World ink (outlines on the 3D geometry)

- **Which edges get a line:** silhouettes, depth jumps between objects, convex creases (box corners, table tops, wall tops, window frames) and contacts (object on floor). **No line** on room-shell concave junctions (wall/floor, baseboards) or the sea horizon.
- **Width:** about **3 px at 1080p** and it stays nearly constant on screen as objects shrink (about 3.4 px near to 2.2 px far, thinning and lightening only mildly). Depth jump about 3.1, silhouette about 3.0, convex crease about 2.2, contact about 2.4 px.
- **Look:** crisp (anti-aliased only), near-black `#0b0a0c`. Total ink about 2-2.6% of pixels.
- **Applied before the depth of field**, so the DOF blurs lines along with the background.
- **Not drawn on the character cards.** Characters keep their own plum outline from 6.2. No double outlines.
- **Implementation (from the study):** a standalone `InkPass extends Pass` (not an Effect, because R3F merges consecutive Effects into one pass and the DOF then erases the ink). It renders a world-only normal + depth target, then an edge mask using a scale-normalised depth test plus a normal-angle test, then composites into the colour buffer before DOF. A Laplacian of 1/z alone cannot see creases or contacts.

### 6.8 Lighting

- **Two-tone shadows.** Shadows are lighter and keep their colour; they are not grey or black.
  - Day: shade/lit luminance about **0.49-0.52**, slightly redder and not less saturated (lit/shadow ratio about 2.8-4.4:1, median about 3.5:1). Shadow L* about 42-55, e.g. `#6a6d92`, `#7481b8`, `#5e6474`.
  - Golden: violet-blue shadows on orange ground (e.g. `#db9044` to `#5b5173`), shade luminance about 0.15-0.27, blue channel up to about 3x lit. Golden shadow example `#514d74`. Do this in the material (a shadow-tint term where sun visibility is below 1), not in the grade.
- **Key light direction, frozen per shot:**
  - Day: from the side and slightly behind (about az 75°, el 48°). Gives lit and shade sides on facades and shadows across the ground.
  - Golden: **backlit**, sun ahead of the camera (about az 15°, el 9°). Long shadows toward the camera, sun glow at the frame edge. This is the signature sunset look.
- Characters: **no emissive** (at most 0.12). They are shaded by the scene light and tinted by it.
- Heads stay bright (V about 0.97) in every light, tinted by the scene; side gradient about 14% toward the key.
- **No SSAO.** Contact comes from ink lines, blobs and two-tone shadows.
- Shadow map 4096, PCF soft; keep in-focus edges about 3-10 px (softness comes from DOF, not blur radius). At golden hour the shadow frustum needs to reach about 14-16 m because shadows are long.
- Colours shift naturally under coloured light. Do not colour-correct objects against the lighting.

### 6.9 Depth: DOF, haze, glow

**Depth of field** is a deliberate **per-shot choice** and is **on in only about one third of shots**.

| Shot type | Background blur when on (sigma at 720p) | Blur-disc radius at 1080p |
|---|---|---|
| Close-up | about 4.2 | about 12.5 px |
| Medium | about 4.0 | about 12 px |
| Full | about 2.7 | about 8 px |
| Wide | about 1.9 | about 5.7 px |

Rule of thumb: **disc radius at 1080p about 3 x sigma(720p).**

- ON for intimate close/medium beats, inserts and foreground-framed shots. OFF for establishing and most full shots.
- Baseline line work is crisp (edge sigma about 0.33).
- Blur follows a thin-lens curve and saturates beyond about 3x the focus distance.
- Foreground objects blur strongly (sigma about 3.7-7.8).
- **No focus pulls inside a shot.** Change DOF only at cuts or ramp it with a camera move.
- The stock postprocessing `DepthOfFieldEffect` is too weak (its blur radius is capped at `bokehScale` px). The study's recommendation is a custom **thin-lens gather effect**.

**Atmosphere**

- Distance haze: far things sit about 40% closer to the horizon colour than near things; darkest far pixels lifted to about 15% of the horizon colour; far ink lifts toward the fog colour.
- Fog (day example): colour `#b0c0e8`, near 25, far 420. Fog (golden example): colour `#f4c68c`, near 20, far 360.

**Glow / bloom**

- Glow only where light is **emitted** (sun, moon, lamps, fire, sparks). White heads and lit surfaces never glow.
- Bloom: threshold **1.0**, smoothing 0.2, intensity 0.5, mipmap blur, levels 6, radius 0.6.
- Emissive sources use HDR colours (e.g. sun disc about `(3.0, 2.6, 2.0)`, sparks about `(8, 6, 3)`) plus a flat additive halo sprite (radius about 2.2 x the source).
- Whites must actually reach about 0.97-1.0 in the final frame.

### 6.10 Colour grade (last step of the post chain)

One `GradeEffect` placed **after tone mapping**, with a **day** and a **golden** preset (golden at amount about 0.8). It sets the tone curve, black point, saturation, tint and vignette. A grade cannot fix dark albedo, brown shadows or missing hue families; those are fixed in materials and lights.

| Target (day, per-frame medians) | Value |
|---|---|
| Median luma Y' | **about 0.57** |
| p99 luma | about 0.97 (real near-whites) |
| Darkest 0.5% (black point) | warm and lifted, about RGB (35, 19, 20); never blue-black or pure black |
| Non-ink p5 luma | about 0.23 (no big black areas) |
| Lit chroma C* p50 / p90 | at least 32 / 55 |
| Vignette (corner vs centre luma) | about 0.86 (gentle darkening only) |
| Golden median luma | about 0.52 |

Golden needs hue families beyond orange: roughly 20% red/rose (`#f09a93`, `#d588a5`) and roughly 17% blue/violet/magenta (`#717be8`, `#8967b1`, `#a065a0`), via violet sky and shadow fill and red/rose accents in the set dressing.

### 6.11 Captions and audio

- **One word at a time** (two for tiny words like "a" or "the"), centred, at about **70% down the frame** (the reference sits at 60-74%).
- White **Poppins Bold**, thick black outline, soft shadow, sentence case, punctuation kept.
- Switch on the exact word times, with a tiny scale pop (about 8%) on each new word. Never draw a running subtitle line.
- Transitions: hard cut on a word beat by default; dissolve (6-10 frames) only for a jump in time or place; circle iris for "looking through a lens, window or mirror".
- Fast action: motion blur, dust and speed lines. Impacts: the kick from 6.5.
- **SFX:** pop or sting on shot changes with new text, whoosh on fast cuts, thud on impacts, an ambience bed under each location, a bright ding on the reveal. Volumes about 0.3-0.6, each placed on a word timestamp.

---

## 7. Render rules (never break)

1. Output is **1080x1920 (Shorts) or 1920x1080 (long-form)**, never 720p.
2. **Vignette:** gentle and circular (exponent about 1.0, never above 1.1; floor never below 0.7; e.g. strength 0.26, floor 0.74). No dark oval.
3. **Grain:** if used, **one static field per shot**, never indexed by frame number (per-frame grain makes the h264 file huge). Target **under 10 Mbps**.
4. No blown-out white horizon glow.
5. Real motion, not a moving slideshow.
6. **Weak machine plan:** render **per shot**, keep memory low, always make a low-res contact sheet first, and render at full size only after approval. Keep render concurrency at 1 unless the owner says otherwise. Give a render-time estimate before a long render.

---

## 8. Shorts vs long-form

| | Shorts | Long-form |
|---|---|---|
| Frame | 1080x1920 | 1920x1080 |
| Length | about 60 s, about 1000 characters of voiceover | several minutes, split into scenes |
| Shot length | about 2 s average, max 4 s | not studied (extrapolate carefully: start from the same grammar, allow slightly longer holds, confirm with the owner) |
| Captions | one word, about 70% down | same style (confirm placement for landscape) |
| Rendering | per shot | per scene, then per shot inside it; stitch with ffmpeg |
| Ending | simple subscribe line | simple subscribe line |

All look rules in section 6 carry over. Only Shorts were measured in the studies, so long-form framing numbers (head-top heights, move counts per 10 s) are to be tested on a first long-form scene.

---

## 9. QA checklist (measure the final graded frame)

**Character**

- [ ] Adults at 3.5 HH, kids 2.85 HH; head H/W about 0.94 with taper, asymmetry, tilt.
- [ ] Limbs are thin single strokes, hands are ink dots, torso is a bean.
- [ ] Faces light (luma at least 0.85), no blush, no catchlights, eyes about 0.26 W apart.
- [ ] Plum outline with thick-thin weighting; on-screen ink not crushed to pure black.

**World and light**

- [ ] World ink visible on silhouettes, depth jumps, creases and contacts, about 3 px at 1080p, none on character cards.
- [ ] Day shade/lit about 0.45-0.55 with colour kept; golden shadows violet-blue (blue ratio at least 1.3, aim 2-3).
- [ ] Golden shots are backlit with long shadows toward the camera.
- [ ] No black areas; non-ink p5 luma well above 0.1 (target about 0.23).
- [ ] Day median luma about 0.57; whites reach about 0.97+.
- [ ] DOF on in about a third of shots, none inside a shot; haze visible on far objects.
- [ ] Bloom only on emissive sources.

**Motion**

- [ ] No camera move above about 25 px/f at 720p (about 37 px/f at 1080p); big jumps are cuts.
- [ ] Push-in on holds; no hand-held float.
- [ ] Impacts are 6-7 frame kicks; whips (if any) are blurred.
- [ ] Characters on ones, feet planted, blinks every 0.5-2.3 s.
- [ ] Extras frozen except on cue.

**Delivery**

- [ ] 1080p, under 10 Mbps, static grain only, gentle vignette.
- [ ] Every phrase has its own picture; a new image at least every 2 s.
- [ ] Captions switch on exact word times.

**Calibration loop (after the first real render):** render a few test stills (day, golden, close-up, wide), measure shade/lit ratios, head luma, black point and ink coverage against the tables above, and rescale the offending channel until it lands. Two rounds are usually enough.

---

## 10. Known conflicts and open decisions

1. **Idle loops on extras.** The motion study says reference background crowds are frozen except on cue. The owner's older videos guide asked for small idle loops on the crowd. Default here: **frozen except on cue**, with an optional per-scene idle flag. Owner to confirm.
2. **Sky colours.** The depth, grade and textures reports suggest slightly different top and horizon colours (especially golden top: `#443876` vs `#6a4f8c` vs `#8c78c4`). The stops in 6.6 are the working defaults; final values are set in the calibration loop.
3. **Hat and hair colour vs plum outline.** Dark hats must be lighter than black (for example `#3a3d47`) so the outline reads.
4. **Python engine vs this engine.** Assumed: both coexist; the Python pack is not modified.
5. **Study scope.** The numbers were measured on one bridge short (day and golden light, army and townsfolk cast). Night, interiors and other characters use the same rules but are less measured (night and interior frames exist in the grade study).
6. **Postprocessing quirks.** Consecutive R3F effects merge into one pass, which breaks the ink and DOF order; the ink must be its own Pass, grade last after tone mapping, bloom before tone mapping.

---

## 11. What gets built first (once the owner says "go")

Proposed order, each step small and checked before the next:

1. Project skeleton, pinned versions, words.json loader, shot runner.
2. One character (adult build, plum outline, faces, shading) rendered as a billboard in a test world.
3. Camera glides, push-in, kick, cut.
4. World ink pass, two-tone shadows, sky/fog, grade.
5. Thin-lens DOF and bloom.
6. A **3-5 second test clip** and a contact sheet for the owner to judge.
7. Only then a full video.

---

## 12. Source material

Studies this README was built from (private, owner's machine): `CONTEXT.md`, `characters.md`, `depth.md`, `grade.md`, `lighting.md`, `motion.md`, `outlines.md`, `textures.md`, and the earlier `videos_guide.md` (idea-generation prompt and style notes). The studies contain full recipes and GLSL/TypeScript snippets (ink pass, thin-lens DOF, grade effect, two-tone shading, cast shading, camera glides). Read the relevant study in full before implementing each module; this README only keeps the rules and numbers.
