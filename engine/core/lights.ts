// engine/core/lights.ts — light presets per time of day (lighting.md §9.1 merged with
// depth.md §6.5 sky/fog and textures.md §5.2 SKY stops). The sun is CAMERA-RELATIVE
// and frozen per shot: az 0 = sun straight ahead (backlight), +90 = screen right,
// 180 = behind camera; el = elevation in degrees.
type C3 = [number, number, number];

export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number; // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean; // contact blobs / card shadows
  sky: { c: [string, string, string, string]; e: [number, number, number] }; // 4-stop sky by elevation (deg)
  fog: string; fogNear: number; fogFar: number;
  sunDisc: string; sunCol: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number;
  bias: number; normalBias: number;
};

export const LIGHTS: Record<"day" | "golden", LightPreset> = {
  day: {
    az: 75, el: 48, // side and slightly behind: lit/shade sides on facades, shadows across ground
    lit: [1.54, 1.47, 1.35], shade: [0.8, 0.71, 0.83], lift: [0, 0, 0], lambert: 0.35, sideK: 0.82, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.9, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false, // by day cards get blobs, not cast shadows
    sky: { c: ["#d8ecf7", "#8ccbf8", "#4aa3f2", "#2a7fe6"], e: [3, 12, 30] },
    fog: "#b0c0e8", fogNear: 25, fogFar: 420,
    sunDisc: "#000000", sunCol: "#fff3e0", sunI: 2.3, hemiSky: "#dcecff", hemiGround: "#b49a78", hemiI: 0.9,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 15, el: 9, // backlit: sun just ahead of the camera, long shadows toward it, glow at frame edge
    lit: [1.42, 0.79, 0.48], shade: [0.176, 0.206, 0.72], lift: [0.035, 0.03, 0.075], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.8, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true, // golden: long soft card shadows plus a blob
    sky: { c: ["#ffd08a", "#ffad7e", "#e9849a", "#8c78c4"], e: [4, 14, 32] },
    fog: "#f4c68c", fogNear: 20, fogFar: 360,
    sunDisc: "#ffd9a0", sunCol: "#ffab5e", sunI: 5.5, hemiSky: "#b9a4e0", hemiGround: "#7a5a6a", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
};
