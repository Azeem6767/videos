// src/Root.tsx — registers one Composition per video under videos/<name>/ (README §4).
// To add a video: create videos/<name>/{story.ts, <Name>Clip.tsx} and add one <Composition> here.
import React from "react";
import { Composition } from "remotion";
import { TestClip, TEST_META } from "../videos/test/TestClip";

export const Root: React.FC = () => (
  <>
    <Composition
      id={TEST_META.id}
      component={TestClip}
      durationInFrames={TEST_META.frames}
      fps={TEST_META.fps}
      width={TEST_META.width}
      height={TEST_META.height}
    />
  </>
);
