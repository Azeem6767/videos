// engine/world/world.tsx — the 3D world shell: 4-stop sky shader, fog, camera-relative frozen sun
// (4096 shadow map), hemisphere for unpatched materials, water, clouds, contact blobs, sun disc +
// halo (depth.md §6.5, lighting.md §9, textures.md §5). One World per scene; setLight() is called
// per shot from the scene runner (the sun is camera-relative and frozen per shot).
import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { LightPreset } from "../core/lights";
import type { V3 } from "../core/types";
import { rad } from "../core/util";
import { applyPreset } from "./shade";
import { waterNear, waterFar, cloudHD, CLOUD_DAY, CLOUD_GOLD } from "./paint";

export type WorldHandle = {
  scene: THREE.Scene;
  /** set the light preset for a shot; sun is placed relative to the camera and frozen */
  setLight: (p: LightPreset, camPos: V3, camLook: V3) => void;
  /** soft contact blob under a standing card (README §6.4): 0.5 W x 0.06 W, alpha 0.3, blurred */
  blob: (x: number, z: number, w: number) => void;
  /** canvas angle (rad, y-down) the light comes FROM, for the character pen (cast.ts/body.ts) */
  lightAngle: (cam: THREE.PerspectiveCamera) => number;
  sunWorldDir: THREE.Vector3;
};

const SKY_VERT = /* glsl */ `
varying vec3 vP;
void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// 4-stop gradient by elevation in degrees (textures.md §3.12: saturated, hue goes through
// coral/pink/lilac at golden hour, never grey-mauve).
const SKY_FRAG = /* glsl */ `
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 stops; // stops = [e0, e1, e2] deg
varying vec3 vP;
float ss(float a, float b, float x) { float t = clamp((x - a) / max(b - a, 1e-4), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void main() {
  float el = degrees(asin(clamp(normalize(vP).y, -1.0, 1.0)));
  vec3 c = mix(c0, c1, ss(0.0, stops.x, el));
  c = mix(c, c2, ss(stops.x, stops.y, el));
  c = mix(c, c3, ss(stops.y, stops.z, el));
  gl_FragColor = vec4(c, 1.0);
}
`;

const WATER_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
// Flat saturated gradient with distance (lighter/cyan at the horizon) + sparse crest/trough/glint
// marks that thin out toward the camera (textures.md §3.11). No reflections.
const WATER_FRAG = /* glsl */ `
uniform sampler2D tNear; uniform sampler2D tFar;
uniform vec3 fogColor; uniform vec3 sunColor; uniform float fogNear; uniform float fogFar; uniform float time;
varying vec3 vW;
void main() {
  float d = length(vW.xz - cameraPosition.xz);
  vec3 nearCol = vec3(0.23, 0.45, 0.66);
  vec3 col = mix(nearCol, fogColor, smoothstep(fogNear * 0.4, fogFar, d));
  float drift = time * 0.35;
  vec3 nearM = texture2D(tNear, (vW.xz + vec2(drift, drift * 0.6)) / 8.0).rgb;
  vec3 farM = texture2D(tFar, (vW.xz - vec2(drift * 0.7, drift)) / 40.0).rgb;
  float wNear = 1.0 - smoothstep(18.0, 30.0, d);   // marks thin toward the camera
  float wFar = smoothstep(25.0, 60.0, d);
  vec3 m = nearM * wNear + farM * wFar;
  col += m.r * 0.16 * sunColor * 0.6 - m.g * 0.10 + m.b * 0.35 * sunColor;
  float f = smoothstep(fogNear, fogFar, d);
  col = mix(col, fogColor, f * 0.85);
  gl_FragColor = vec4(col, 1.0);
}
`;

const haloTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const blobTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,0.32)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

export type WorldProps = {
  /** sea plane (pirate scene); otherwise a ground plane */
  water?: boolean;
  groundColor?: string;
  groundTex?: () => THREE.Texture;
  cloudCount?: number;
};

export const World = React.forwardRef<WorldHandle, WorldProps>((props, ref) => {
  const { scene } = useThree();
  const sunDir = useRef(new THREE.Vector3(0, 1, 0));
  const internals = useMemo(() => {
    // --- fog ---
    scene.fog = new THREE.Fog(0xb0c0e8, 25, 420);
    // --- sky dome ---
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        c0: { value: new THREE.Color("#d8ecf7") }, c1: { value: new THREE.Color("#8ccbf8") },
        c2: { value: new THREE.Color("#4aa3f2") }, c3: { value: new THREE.Color("#2a7fe6") },
        stops: { value: new THREE.Vector3(3, 12, 30) },
      },
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat);
    sky.renderOrder = -10; sky.frustumCulled = false;
    scene.add(sky);
    // --- lights ---
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 260; // golden: long shadows need ~14-16 m frustum
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.015;
    scene.add(sun); scene.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xdcecff, 0xb49a78, 0.9); // only unpatched materials (sky sprites etc.)
    scene.add(hemi);
    // --- sun disc + halo (golden backlight glow; HDR colour so bloom picks it up) ---
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), fog: false, depthWrite: false })
    );
    disc.renderOrder = -9; disc.frustumCulled = false;
    scene.add(disc);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.9,
    }));
    halo.scale.set(120, 120, 1); halo.renderOrder = -8; halo.frustumCulled = false;
    scene.add(halo);
    // --- ground / sea ---
    let ground: THREE.Mesh | null = null;
    if (props.water) {
      const wmat = new THREE.ShaderMaterial({
        vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: false,
        uniforms: {
          tNear: { value: waterNear() }, tFar: { value: waterFar() },
          fogColor: { value: new THREE.Color(0xb0c0e8) }, sunColor: { value: new THREE.Color(1, 0.95, 0.85) },
          fogNear: { value: 25 }, fogFar: { value: 420 }, time: { value: 0 },
        },
      });
      ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), wmat);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
    } else if (props.groundColor) {
      const mat = new THREE.MeshLambertMaterial({ color: props.groundColor, map: props.groundTex?.() ?? null });
      ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
    }
    // --- clouds (two palettes prebuilt; setLight swaps the map) ---
    const clouds: THREE.Sprite[] = [];
    const n = props.cloudCount ?? 8;
    for (let i = 0; i < n; i++) {
      const day = new THREE.SpriteMaterial({ map: cloudHD(i % 4, CLOUD_DAY), transparent: true, depthWrite: false });
      const gold = new THREE.SpriteMaterial({ map: cloudHD(i % 4, CLOUD_GOLD), transparent: true, depthWrite: false });
      const s = new THREE.Sprite(day);
      (s.material as THREE.SpriteMaterial & { gold?: THREE.SpriteMaterial }).gold = gold;
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const dist = 320 + (i % 4) * 110;
      s.position.set(Math.cos(a) * dist, 70 + (i % 5) * 26, Math.sin(a) * dist);
      const w = 130 + (i % 3) * 45;
      s.scale.set(w, w / 2, 1);
      scene.add(s); clouds.push(s);
    }
    // --- contact blob pool (drawn before the cards, renderOrder 0; cards are renderOrder 1) ---
    const bt = blobTex();
    const blobs: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.12),
        new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, color: 0x9e9494 })
      );
      m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 0; m.visible = false;
      scene.add(m); blobs.push(m);
    }
    const added: THREE.Object3D[] = [sky, sun, sun.target, hemi, disc, halo];
    if (ground) added.push(ground);
    added.push(...clouds, ...blobs);
    return { skyMat, sun, hemi, disc, halo, ground, clouds, blobs, added, waterMat: ground && props.water ? (ground.material as THREE.ShaderMaterial) : null };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    for (const o of internals.added) scene.remove(o);
    scene.fog = null;
  }, [scene, internals]);

  useImperativeHandle(ref, () => ({
    scene,
    setLight(p: LightPreset, camPos: V3, camLook: V3) {
      // camera-relative frozen sun: az 0 = straight ahead of the camera (backlight), +90 = screen right
      const f = new THREE.Vector3(camLook[0] - camPos[0], camLook[1] - camPos[1], camLook[2] - camPos[2]).normalize();
      const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
      const az = rad(p.az), el = rad(p.el);
      const dir = new THREE.Vector3()
        .addScaledVector(f, Math.cos(el) * Math.cos(az))
        .addScaledVector(r, Math.cos(el) * Math.sin(az))
        .add(new THREE.Vector3(0, Math.sin(el), 0))
        .normalize();
      sunDir.current.copy(dir);
      internals.sun.position.copy(new THREE.Vector3(...camPos)).addScaledVector(dir, 120);
      internals.sun.target.position.set(...camPos);
      internals.sun.color.set(p.sunCol); internals.sun.intensity = p.sunI;
      internals.sun.shadow.bias = p.bias; internals.sun.shadow.normalBias = p.normalBias;
      internals.hemi.color.set(p.hemiSky); internals.hemi.groundColor.set(p.hemiGround); internals.hemi.intensity = p.hemiI;
      const fog = scene.fog as THREE.Fog;
      fog.color.set(p.fog); fog.near = p.fogNear; fog.far = p.fogFar;
      const u = internals.skyMat.uniforms;
      (u.c0.value as THREE.Color).set(p.sky.c[0]); (u.c1.value as THREE.Color).set(p.sky.c[1]);
      (u.c2.value as THREE.Color).set(p.sky.c[2]); (u.c3.value as THREE.Color).set(p.sky.c[3]);
      u.stops.value.set(p.sky.e[0], p.sky.e[1], p.sky.e[2]);
      // sun disc + halo: HDR emissive colour so bloom (threshold 1.0) glows only on it
      const golden = p.sunDisc !== "#000000";
      internals.disc.visible = golden; internals.halo.visible = golden;
      if (golden) {
        const c = new THREE.Color(p.sunDisc);
        (internals.disc.material as THREE.MeshBasicMaterial).color.setRGB(c.r * 3.0, c.g * 2.6, c.b * 2.0);
        internals.disc.position.copy(new THREE.Vector3(...camPos)).addScaledVector(dir, 900);
        internals.disc.lookAt(...camPos);
        internals.halo.position.copy(internals.disc.position);
        internals.halo.lookAt(...camPos);
      }
      if (internals.waterMat) {
        (internals.waterMat.uniforms.fogColor.value as THREE.Color).set(p.fog);
        internals.waterMat.uniforms.fogNear.value = p.fogNear;
        internals.waterMat.uniforms.fogFar.value = p.fogFar;
        (internals.waterMat.uniforms.sunColor.value as THREE.Color).set(p.sunCol);
      }
      for (const s of internals.clouds) {
        const m = s.material as THREE.SpriteMaterial & { gold?: THREE.SpriteMaterial };
        s.material = golden ? (m.gold ?? m) : m;
      }
      for (const b of internals.blobs) (b.material as THREE.MeshBasicMaterial).color.setRGB(...p.blob);
      applyPreset(p);
    },
    blob(x: number, z: number, w: number) {
      const b = internals.blobs.find((m) => !m.visible) ?? internals.blobs[0];
      b.visible = true;
      b.position.set(x, 0.012, z);
      b.scale.set(w, 1, 1);
    },
    lightAngle(cam: THREE.PerspectiveCamera) {
      const v = sunDir.current.clone().applyMatrix4(new THREE.Matrix4().copy(cam.matrixWorldInverse));
      return Math.atan2(-v.y, v.x); // canvas coords (y down): angle the light comes FROM
    },
    sunWorldDir: sunDir.current,
  }), [scene, internals]);

  // water time drift
  const wmat = internals.waterMat;
  useEffect(() => {
    if (!wmat) return;
    let raf = 0;
    const tick = () => { wmat.uniforms.time.value += 1 / 30; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wmat]);

  return null;
});
