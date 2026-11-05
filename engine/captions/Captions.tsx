// engine/captions/Captions.tsx — one-word-at-a-time caption overlay (README §6.11, CONTEXT.md).
// White Poppins Bold, thick near-black outline, soft shadow, sentence case, ~70% down the frame.
// Switches on the exact word times from words.json, with an ~8% scale pop on each new word.
// Drop Poppins-Bold.ttf into public/fonts/ and pass fontFile="fonts/Poppins-Bold.ttf" for the
// exact face; otherwise the bold sans stack below is used.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, staticFile, useVideoConfig } from "remotion";
import { wordAt, sec2frame, type Words } from "../core/words";
import { FPS } from "../core/util";

export const Captions: React.FC<{ words: Words; yPct?: number; fontFile?: string }> = ({ words, yPct = 0.70, fontFile }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame / FPS;
  const w = wordAt(words, t);
  const startF = w ? sec2frame(w.start) : 0;
  const pop = w ? interpolate(frame - startF, [0, 4], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const fontPx = Math.round(height * 0.052);
  const stroke = Math.max(2, Math.round(fontPx * 0.14));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {fontFile && (
        <style>{`@font-face { font-family: "PoppinsLocal"; src: url(${staticFile(fontFile)}); font-weight: 800; }`}</style>
      )}
      {w && (
        <div
          style={{
            position: "absolute",
            top: `${yPct * 100}%`,
            left: "50%",
            transform: `translate(-50%, -50%) scale(${pop})`,
            fontFamily: fontFile ? "PoppinsLocal, Poppins, sans-serif" : "Poppins, 'DejaVu Sans', 'Arial Black', sans-serif",
            fontWeight: 800,
            fontSize: fontPx,
            color: "#ffffff",
            WebkitTextStroke: `${stroke}px #141016`,
            paintOrder: "stroke fill",
            textShadow: "0 4px 14px rgba(0,0,0,0.45)",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {w.word}
        </div>
      )}
    </AbsoluteFill>
  );
};
