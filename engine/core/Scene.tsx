// engine/core/Scene.tsx — the shot runner glue inside a Remotion composition (README §5).
// Owns the R3F canvas: per frame it resolves the shot, runs the camera rig (camAt), applies the
// shot's light preset to the world (frozen, camera-relative sun), sets DOF + grade, re-faces and
// re-poses every actor (drawn on ones), and drives the post chain (Post.tsx order:
// bloom -> ink -> lens -> tone -> grade -> whip).
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame } from "remotion";
import type { Story } from "./story";
import type { Cam } from "./types";
import { FORMATS } from "./types";
import { FPS } from "./util";
import { shotAt } from "./shots";
import { camAt, keyEnd, type Key } from "./camera";
import { dofAt } from "./dof";
import { LIGHTS } from "./lights";
import { Actor } from "../characters/cast";
import { cardShade } from "../world/shade";
import { World, type WorldHandle } from "../world/world";
import { makeFx, Post } from "../post/Post";
import { GRADE_DAY, GRADE_GOLDEN } from "../post/grade";
import type { Build } from "../characters/outfits";

/** world height of a card per build (adult 3.5 HH etc. -> ~1.8 m); plane aspect 600/1000 */
const CARD_H: Record<Build, number> = { adult: 1.8, stout: 1.78, kid: 1.45 };

const Rig: React.FC<{
  story: Story;
  worldRef: React.RefObject<WorldHandle | null>;
}> = ({ story, worldRef }) => {
  const { scene, camera } = useThree();
  const frame = useCurrentFrame();
  const fx = useMemo(() => makeFx(scene, camera as THREE.PerspectiveCamera), [scene, camera]);
  const actors = useMemo(
    () => story.actors.map((a, i) => new Actor(i, a.outfit, a.pos, a.build ?? "adult", a.seed ?? i * 7 + 3)),
    [story.actors]
  );
  useEffect(() => {
    for (const a of actors) {
      cardShade(a.mat);
      scene.add(a.mesh);
    }
    return () => { for (const a of actors) scene.remove(a.mesh); };
  }, [scene, actors]);

  const prev = useRef<Cam | null>(null);
  const prevCamObj = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(() => {
    const f = frame, t = f / FPS;
    const shot = shotAt(story.shots, f);
    const cam = camAt(story.keys, f, t, story.kicks ?? []);
    const cam3 = camera as THREE.PerspectiveCamera;
    cam3.position.set(...cam.pos);
    cam3.up.set(0, 1, 0);
    cam3.lookAt(...cam.look);
    if (cam.roll) cam3.rotateZ(cam.roll);
    cam3.fov = cam.fov;
    cam3.near = 0.1;
    cam3.far = 5000; // sky dome (r=1500) and sun disc (900 m) must not clip
    cam3.updateProjectionMatrix();

    const wh = worldRef.current;
    if (wh) {
      const preset = LIGHTS[shot.light];
      wh.setLight(preset, cam.pos, cam.look);
      // DOF: per-shot cInf; no focus pulls inside a shot (README §6.9)
      const d = dofAt(story.dofs, f);
      fx.lens.cInf = d.cInf;
      fx.lens.focus = d.focus ? cam3.position.distanceTo(new THREE.Vector3(...d.focus(f))) : 12;
      // grade: preset per light, golden at amount 0.8 (README §6.10)
      fx.grade.set(shot.light === "golden" ? GRADE_GOLDEN : GRADE_DAY);
      fx.grade.amount = shot.light === "golden" ? 0.8 : 1.0;
      // whip / transition blur: screen-space velocity of the look point, 0.5 shutter (UV = ndc/2)
      const p1 = new THREE.Vector3(...cam.look).project(cam3);
      if (prev.current && prevCamObj.current) {
        const p0 = new THREE.Vector3(...prev.current.look).project(prevCamObj.current);
        fx.whip.vel = new THREE.Vector2((p1.x - p0.x) * 0.5, -(p1.y - p0.y) * 0.5);
      } else {
        fx.whip.vel = new THREE.Vector2(0, 0);
      }
      const la = wh.lightAngle(cam3);
      const ke = keyEnd(story.keys as Key[], f);
      actors.forEach((a, i) => {
        a.face(cam3, ke);
        const h = CARD_H[a.build];
        a.mesh.scale.set(a.mesh.scale.x * h * 0.6, h, a.mesh.scale.z * h);
        const p = story.pose(i, { f, t, shot, cam, prevCam: prev.current, light: shot.light });
        a.bind({ light: la, ...p.opts }, p.side, la);
        a.mesh.castShadow = preset.actorShadow;
        a.mesh.customDepthMaterial = preset.actorShadow ? a.dmat : undefined;
        wh.blob(a.pos[0], a.pos[2], a.mesh.scale.x * 1.1);
      });
    }
    prev.current = cam;
    prevCamObj.current = cam3.clone();
    prevCamObj.current.updateMatrixWorld();
  });
  return <Post fx={fx} />;
};

/** A full video scene: <ToonScene story={...}> inside the composition, plus <Captions/> and audio. */
export const ToonScene: React.FC<{ story: Story; children?: React.ReactNode }> = ({ story, children }) => {
  const fmt = FORMATS[story.format];
  const worldRef = useRef<WorldHandle | null>(null);
  return (
    <ThreeCanvas
      width={fmt.w}
      height={fmt.h}
      style={{ background: "#000" }}
      gl={{ antialias: true, alpha: false }}
      dpr={1}
    >
      <World
        ref={(w) => { worldRef.current = w; }}
        water={story.world?.water}
        groundColor={story.world?.groundColor ?? "#73b23d"}
        cloudCount={story.world?.cloudCount}
      />
      {children}
      <Rig story={story} worldRef={worldRef} />
    </ThreeCanvas>
  );
};
