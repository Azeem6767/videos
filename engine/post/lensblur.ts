// engine/post/lensblur.ts — thin-lens depth of field, single gather pass (depth.md recipe 6.1).
// Replaces the stock DepthOfFieldEffect (its bokeh radius is capped at bokehScale px and its
// smoothstep CoC under-blurs the foreground). CoC radius in output px = cInf * |1 - focus/depth|,
// near side x nearScale, clamped to maxCoC. Pass 1 gathers the pixel's own disc (background never
// bleeds over a nearer pixel); pass 2 lets a blurred foreground spread over sharper pixels behind.
// CONVOLUTION attribute => @react-three/postprocessing keeps it in its own EffectPass.
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const frag = /* glsl */ `
uniform float focus;      // focus distance along the view axis (m)
uniform float cInf;       // blur-disc radius (px, output res) of things at infinity; 0 = off
uniform float nearScale;  // extra blur for things in front of the focus plane
uniform float maxCoC;     // px
#define TAPS 64
#define NEAR_TAPS 32
#define GOLDEN 2.39996323

float cocAt(float d) {
  float c = cInf * (1.0 - focus / max(d, 1e-3));
  if (c < 0.0) c *= nearScale;
  return clamp(c, -maxCoC, maxCoC);
}
float distAt(vec2 uv) { return -getViewZ(readDepth(uv)); }
float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (cInf < 0.25) { outputColor = inputColor; return; }
  float d0 = -getViewZ(depth);
  float r0 = abs(cocAt(d0));
  float rot = hash12(gl_FragCoord.xy) * 6.2831853;   // fixed per pixel: no frame-to-frame shimmer
  vec3 acc = inputColor.rgb; float wsum = 1.0;
  if (r0 > 0.5) {
    for (int i = 0; i < TAPS; i++) {
      float rr = sqrt((float(i) + 0.5) / float(TAPS)) * r0;
      float a = float(i) * GOLDEN + rot;
      vec2 suv = uv + vec2(cos(a), sin(a)) * rr * texelSize;
      float ds = distAt(suv);
      float rs = abs(cocAt(ds));
      if (ds > d0) rs = min(rs, r0);
      float w = clamp(rs - rr + 0.5, 0.0, 1.0);
      acc += texture2D(inputBuffer, suv).rgb * w; wsum += w;
    }
  }
  vec3 col = acc / wsum;
  vec3 fg = vec3(0.0); float fw = 0.0, cov = 0.0;
  for (int i = 0; i < NEAR_TAPS; i++) {
    float rr = sqrt((float(i) + 0.5) / float(NEAR_TAPS)) * maxCoC;
    if (rr <= r0) continue;
    float a = float(i) * GOLDEN + rot + 1.0;
    vec2 suv = uv + vec2(cos(a), sin(a)) * rr * texelSize;
    float ds = distAt(suv);
    if (ds >= d0 * 0.97) continue;
    float rs = abs(cocAt(ds));
    float w = clamp(rs - rr + 0.5, 0.0, 1.0);
    fg += texture2D(inputBuffer, suv).rgb * w; fw += w;
    cov += w * (maxCoC * maxCoC) / max(rs * rs, 1.0);
  }
  if (fw > 0.0) col = mix(col, fg / fw, clamp(cov / float(NEAR_TAPS), 0.0, 1.0));
  outputColor = vec4(col, inputColor.a);
}`;

export class LensBlurEffect extends Effect {
  constructor({ maxCoC = 24, nearScale = 1.2 } = {}) {
    super("LensBlurEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["focus", new Uniform(10)], ["cInf", new Uniform(0)],
        ["nearScale", new Uniform(nearScale)], ["maxCoC", new Uniform(maxCoC)],
      ]),
    });
  }
  set focus(v: number) { this.uniforms.get("focus")!.value = v; }
  set cInf(v: number) { this.uniforms.get("cInf")!.value = v; }
}
