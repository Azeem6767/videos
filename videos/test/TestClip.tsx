// videos/test/TestClip.tsx — composition component for the engine test clip.
import React from "react";
import { AbsoluteFill } from "remotion";
import { ToonScene } from "../../engine/core/Scene";
import { Captions } from "../../engine/captions/Captions";
import { Sfx } from "../../engine/audio/sfx";
import { FORMATS } from "../../engine/core/types";
import { FPS } from "../../engine/core/util";
import { lam } from "../../engine/world/shade";
import { planksHD } from "../../engine/world/paint";
import { Crate, Barrel } from "../../engine/world/props";
import { testStory } from "./story";

const deckMat = lam({ map: planksHD(), color: "#ffffff" });

const fmt = FORMATS[testStory.format];

export const TEST_META = {
  id: "test",
  fps: fmt.fps,
  width: fmt.w,
  height: fmt.h,
  frames: Math.round(testStory.words.duration * FPS),
};

export const TestClip: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ToonScene story={testStory}>
      {/* deck the crew stands on, plus filler props so no area is empty (README §6.6) */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 0.3, 4.5]} />
        <primitive object={deckMat} attach="material" />
      </mesh>
      <Crate pos={[-2.2, 0.3, -1.2]} size={0.9} rotY={0.4} />
      <Barrel pos={[2.4, 0.3, 0.8]} />
    </ToonScene>
    <Captions words={testStory.words} />
    {testStory.sfx && testStory.sfx.length > 0 && <Sfx hits={testStory.sfx} />}
  </AbsoluteFill>
);
