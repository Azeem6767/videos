// engine/post/grade.ts — GradeEffect: tone curve + zone saturation + zone tint + vignette,
// placed LAST in the composer, after ToneMappingEffect (grade.md §5). Display-referred: it encodes
// the tone-mapped linear input to sRGB, grades, and decodes back. Presets are the fitted
// GRADE_DAY / GRADE_GOLDEN from grade.md §4 (7-knot monotone cubic Hermite curve, zone saturation,
// zero-luma BT.709 Cb/Cr tints stored as RGB offsets, vignette k/r0).
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

export type GradePreset = {
  ky: number[]; // 7 curve knots, y at x = 0,.1,.25,.5,.75,.9,1
  km: number[]; // 7 curve tangents
  sat: [number, number, number]; // saturation multipliers: shadows / mids / highlights
  tintS: [number, number, number]; // RGB offset, shadows
  tintM: [number, number, number]; // RGB offset, mids
  tintH: [number, number, number]; // RGB offset, highlights
  vig: [number, number]; // vignette strength k, start r0
};

/** BT.709 Cb/Cr offset -> zero-luma RGB offset */
const cbCr = (cb: number, cr: number): [number, number, number] => {
  const dR = cr * 1.5748;
  const dB = cb * 1.8556;
  const dG = -(0.2126 * dR + 0.0722 * dB) / 0.7152;
  return [dR, dG, dB];
};

export const GRADE_DAY: GradePreset = {
  ky: [0.0345, 0.1828, 0.3812, 0.6605, 0.8814, 0.9631, 1],
  km: [1.483, 1.404, 1.22, 0.987, 0.661, 0.435, 0.369],
  sat: [0.983, 1.273, 1.457],
  tintS: cbCr(-0.0291, 0.0411),
  tintM: cbCr(0.0376, -0.0104),
  tintH: cbCr(0.0144, -0.0047),
  vig: [0.1, 0.45],
};
export const GRADE_GOLDEN: GradePreset = {
  ky: [0.0311, 0.1877, 0.4017, 0.6754, 0.875, 0.9582, 1],
  km: [1.567, 1.498, 1.253, 0.924, 0.645, 0.472, 0.418],
  sat: [0.832, 0.88, 1.706],
  tintS: cbCr(0.0528, 0.0004),
  tintM: cbCr(0.0583, -0.0003),
  tintH: cbCr(0, 0),
  vig: [0.16, 0.4],
};

const frag = /* glsl */ `
uniform float gradeKy[7];
uniform float gradeKm[7];
uniform vec3 gradeSat;
uniform vec3 gradeTintS;
uniform vec3 gradeTintM;
uniform vec3 gradeTintH;
uniform vec2 gradeVig;
uniform float gradeAmount;

const float KX[7] = float[7](0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0);

vec3 gradeEncode(vec3 c) { // linear -> sRGB
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 gradeDecode(vec3 c) { // sRGB -> linear
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
float gradeCurve(float x) { // monotone cubic Hermite through the 7 knots
  x = clamp(x, 0.0, 1.0);
  int i = 0;
  for (int k = 0; k < 6; k++) if (x >= KX[k + 1]) i = k + 1;
  if (x >= 1.0) i = 5;
  float x0 = KX[i], x1 = KX[i + 1], h = x1 - x0;
  float t = (x - x0) / h;
  float t2 = t * t, t3 = t2 * t;
  float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
  float h10 = t3 - 2.0 * t2 + t;
  float h01 = -2.0 * t3 + 3.0 * t2;
  float h11 = t3 - t2;
  return h00 * gradeKy[i] + h10 * h * gradeKm[i] + h01 * gradeKy[i + 1] + h11 * h * gradeKm[i + 1];
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 src = gradeEncode(inputColor.rgb);
  vec3 c = vec3(gradeCurve(src.r), gradeCurve(src.g), gradeCurve(src.b));
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float y = dot(c, W);
  float wS = 1.0 - smoothstep(0.0, 0.55, y), wH = smoothstep(0.45, 1.0, y), wM = 1.0 - wS - wH;
  float s = gradeSat.y + (gradeSat.x - gradeSat.y) * wS + (gradeSat.z - gradeSat.y) * wH;
  c = vec3(y) + s * (c - vec3(y));
  c += wS * gradeTintS + wM * gradeTintM + wH * gradeTintH;
  float r = length(uv * 2.0 - 1.0) * 0.70710678;          // 1 at the corners
  c *= 1.0 - gradeVig.x * smoothstep(gradeVig.y, 1.0, r);
  c = clamp(c, 0.0, 1.0);
  outputColor = vec4(gradeDecode(mix(src, c, gradeAmount)), inputColor.a);
}`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

export class GradeEffect extends Effect {
  constructor(preset: GradePreset = GRADE_DAY, amount = 1.0) {
    super("GradeEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["gradeKy", new Uniform(preset.ky.slice())],
        ["gradeKm", new Uniform(preset.km.slice())],
        ["gradeSat", new Uniform(preset.sat.slice())],
        ["gradeTintS", new Uniform(preset.tintS.slice())],
        ["gradeTintM", new Uniform(preset.tintM.slice())],
        ["gradeTintH", new Uniform(preset.tintH.slice())],
        ["gradeVig", new Uniform(preset.vig.slice())],
        ["gradeAmount", new Uniform(amount)],
      ]),
    });
    this.amount = amount;
  }
  /** set(p) jumps to a preset; set(p, q, t) blends p->q by t (for light crossfades) */
  set(p: GradePreset, q?: GradePreset, t = 1) {
    const u = this.uniforms;
    const ky = q ? p.ky.map((v, i) => lerp(v, q.ky[i], t)) : p.ky;
    const km = q ? p.km.map((v, i) => lerp(v, q.km[i], t)) : p.km;
    const sat = q ? lerp3(p.sat, q.sat, t) : p.sat;
    const tS = q ? lerp3(p.tintS, q.tintS, t) : p.tintS;
    const tM = q ? lerp3(p.tintM, q.tintM, t) : p.tintM;
    const tH = q ? lerp3(p.tintH, q.tintH, t) : p.tintH;
    const vig = q ? [lerp(p.vig[0], q.vig[0], t), lerp(p.vig[1], q.vig[1], t)] : p.vig;
    u.get("gradeKy")!.value = ky;
    u.get("gradeKm")!.value = km;
    u.get("gradeSat")!.value = sat;
    u.get("gradeTintS")!.value = tS;
    u.get("gradeTintM")!.value = tM;
    u.get("gradeTintH")!.value = tH;
    u.get("gradeVig")!.value = vig;
  }
  get amount() { return this.uniforms.get("gradeAmount")!.value as number; }
  set amount(v: number) { this.uniforms.get("gradeAmount")!.value = v; }
}
