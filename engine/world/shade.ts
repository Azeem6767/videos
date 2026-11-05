// engine/world/shade.ts — stylised two-tone world shading + character-card shading
// (lighting.md §9.2, README §6.8). Every world material goes through twoTone(); actor cards
// through cardShade(). TONE / CHAR are shared uniform objects: updating their .value updates
// every patched material at once, so setLight() just writes these.
import * as THREE from "three";
import type { LightPreset } from "../core/lights";

export const TONE = {
  uLitCol: { value: new THREE.Vector3(1.54, 1.47, 1.35) }, uShadeCol: { value: new THREE.Vector3(0.8, 0.71, 0.83) },
  uShadeLift: { value: new THREE.Vector3() }, uLambert: { value: 0.35 }, uSideK: { value: 0.82 }, uTerm: { value: 0.2 },
};
export const CHAR = {
  uCharTint: { value: new THREE.Vector3(1, 0.94, 0.92) }, uCharShade: { value: 0.86 }, uGrad: { value: 0.07 },
  uBodyGrad: { value: 0.2 }, uSideTint: { value: new THREE.Vector3(0.92, 0.9, 0.96) },
};

// Capture the sun's shadow visibility inside three's light loop (directional light 0 = the only
// shadow caster; three sorts shadow-casting lights first, so only the unrolled index 0 compiles
// the shadow block).
export const LFB = THREE.ShaderChunk.lights_fragment_begin
  .replace("directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]",
           "sunVis = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]")
  .replace("vDirectionalShadowCoord[ i ] ) : 1.0;", "vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= sunVis;");
if (!LFB.includes("directLight.color *= sunVis")) throw new Error("shade.ts: three lights_fragment_begin changed");

const TWO_TONE = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float ndl = max( dot( geometryNormal, sunV ), 0.0 );
  float sunTerm = sunVis * smoothstep( 0.0, uTerm, ndl );
  float skyK = mix( uSideK, 1.0, 0.5 + 0.5 * dot( geometryNormal, upV ) );
  vec3 lit = uLitCol * mix( 1.0, ndl, uLambert );
  reflectedLight.directDiffuse = diffuseColor.rgb * mix( uShadeCol, lit, sunTerm ) * skyK + uShadeLift * ( 1.0 - sunTerm );
  reflectedLight.indirectDiffuse = vec3( 0.0 );
}
#endif
`;
const DECL = "#include <common>\nuniform vec3 uLitCol; uniform vec3 uShadeCol; uniform vec3 uShadeLift; uniform float uLambert; uniform float uSideK; uniform float uTerm;";

/** Lambert (or Phong: its specular term is kept) -> two-tone. Call once per material, before first render. */
export function twoTone<T extends THREE.MeshLambertMaterial | THREE.MeshPhongMaterial>(m: T): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TONE);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + TWO_TONE);
  };
  m.customProgramCacheKey = () => "twoTone1";
  return m;
}

// Character card: bright floor, scene tint, side gradient toward the sun, lavender shadow side.
// No emissive (lighting.md §9.5: cards are shaded by the scene light).
const CARD = /* glsl */ `
vec3 outgoingLight = diffuseColor.rgb * uCharTint;
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float side = clamp( sunV.x * 1.4, -1.0, 1.0 );
  float u = clamp( ( vMapUv.x - 0.5 ) / 0.21, -1.0, 1.0 ) * sign( dFdx( vMapUv.x ) + 1e-7 );
  float t = u * side;
  float head = smoothstep( 0.55, 0.62, vMapUv.y );
  float g = mix( uBodyGrad, uGrad, head );
  float dark = smoothstep( 0.1, 1.0, -t );
  vec3 sideK = mix( vec3( 1.0 ), uSideTint, dark * ( g / max( uGrad, 1e-3 ) ) * 0.5 );
  float top = 1.0 + 0.055 * clamp( ( vMapUv.y - 0.72 ) / 0.15, -1.0, 1.0 ) * clamp( dot( sunV, upV ) * 2.0, 0.0, 1.0 ) * head;
  float lift = 1.0 + 0.03 * max( t, 0.0 );
  outgoingLight *= mix( uCharShade, 1.0, sunVis ) * ( 1.0 - g * dark ) * sideK * top * lift;
}
#endif
`;
export function cardShade(m: THREE.MeshLambertMaterial) {
  m.emissive.set(0x000000); m.emissiveIntensity = 0; m.emissiveMap = null;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CHAR);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uCharTint; uniform float uCharShade; uniform float uGrad; uniform float uBodyGrad; uniform vec3 uSideTint;")
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", CARD);
  };
  m.customProgramCacheKey = () => "card1";
  return m;
}

/** world material helper: two-tone Lambert from a colour or map (lighting.md §9.3 lam()) */
export const lam = (opts: THREE.MeshLambertMaterialParameters = {}) => twoTone(new THREE.MeshLambertMaterial(opts));

/** push a light preset into the shared uniforms (call per shot / per light change) */
export function applyPreset(p: LightPreset) {
  TONE.uLitCol.value.set(...p.lit);
  TONE.uShadeCol.value.set(...p.shade);
  TONE.uShadeLift.value.set(...p.lift);
  TONE.uLambert.value = p.lambert;
  TONE.uSideK.value = p.sideK;
  TONE.uTerm.value = p.term;
  CHAR.uCharTint.value.set(...p.charTint);
  CHAR.uCharShade.value = p.charShade;
  CHAR.uGrad.value = p.charGrad;
  CHAR.uBodyGrad.value = p.bodyGrad;
  CHAR.uSideTint.value.set(...p.sideTint);
}
