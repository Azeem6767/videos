// engine/post/whip.ts — directional motion blur for whip pans / transition pulses (motion.md §5.4).
// Set `vel` each frame to the camera's screen motion between f and f+1 (UV units) x 0.5 shutter,
// and (0,0) otherwise. At most one whip per short, always blurred.
import { Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";

const frag = /* glsl */ `
uniform vec2 vel;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (dot(vel, vel) < 1e-8) { outputColor = inputColor; return; }
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 12; i++) acc += texture2D(inputBuffer, uv + vel * (float(i) / 11.0 - 0.5));
  outputColor = acc / 12.0;
}`;

export class WhipBlur extends Effect {
  constructor() {
    super("WhipBlur", frag, { uniforms: new Map([["vel", new Uniform(new Vector2())]]) });
  }
  set vel(v: Vector2) { this.uniforms.get("vel")!.value.copy(v); }
}
