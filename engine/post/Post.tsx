// engine/post/Post.tsx — the post chain for every video (README §6.7/§6.9/§6.10, study recipes).
// Order matters: bloom (HDR, before tone mapping) -> ink (a Pass, so it stays its own pass and the
// DOF blurs the lines with the background) -> lens (thin-lens DOF, CONVOLUTION => own pass) ->
// tone (NEUTRAL) -> grade (last, display-referred) -> whip (transition blur, on top of everything).
// MSAA 4 on the composer buffer, as verified with the ink pass.
import React, { useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "@react-three/postprocessing";
import { BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass } from "./ink";
import { LensBlurEffect } from "./lensblur";
import { GradeEffect, GRADE_DAY } from "./grade";
import { WhipBlur } from "./whip";

export type Fx = {
  bloom: BloomEffect;
  ink: InkPass;
  lens: LensBlurEffect;
  tone: ToneMappingEffect;
  grade: GradeEffect;
  whip: WhipBlur;
};

/** bloom: threshold 1.0 so only emissive HDR sources glow (white heads stay crisp);
 *  mipmap blur levels 6 radius 0.6 intensity 0.5 = the reference's ~30 px e-fold at 1080p. */
export const makeFx = (scene: THREE.Scene, camera: THREE.PerspectiveCamera): Fx => ({
  bloom: new BloomEffect({ intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 }),
  ink: new InkPass(scene, camera),
  lens: new LensBlurEffect({ maxCoC: 24, nearScale: 1.2 }),
  tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
  grade: new GradeEffect(GRADE_DAY, 1.0),
  whip: new WhipBlur(),
});

export const Post: React.FC<{ fx: Fx }> = ({ fx }) => {
  const el = useMemo(
    () => (
      <EffectComposer multisampling={4}>
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
        <primitive object={fx.whip} dispose={null} />
      </EffectComposer>
    ),
    [fx]
  );
  return el;
};
