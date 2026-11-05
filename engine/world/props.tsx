// engine/world/props.tsx — boxy readable props (README §6.6: world is boxy, simple, painted).
// All materials go through lam() (two-tone, shade.ts). Video-specific builds (ship, map) live
// under videos/<name>/, not here.
import React from "react";
import * as THREE from "three";
import { lam } from "./shade";
import { planksHD, stoneHD } from "./paint";
import type { V3 } from "../core/types";

export const Crate: React.FC<{ pos: V3; size?: number; color?: string; rotY?: number }> = ({ pos, size = 1, color = "#e3b684", rotY = 0 }) => (
  <mesh position={pos} rotation={[0, rotY, 0]} castShadow receiveShadow>
    <boxGeometry args={[size, size, size]} />
    <primitive object={lam({ map: planksHD(), color })} attach="material" />
  </mesh>
);

export const Barrel: React.FC<{ pos: V3; r?: number; h?: number; color?: string }> = ({ pos, r = 0.45, h = 1.1, color = "#a8743f" }) => (
  <mesh position={pos} castShadow receiveShadow>
    <cylinderGeometry args={[r, r * 1.12, h, 14]} />
    <primitive object={lam({ color })} attach="material" />
  </mesh>
);

/** flat sign board on a post — the classic gag carrier (README §5: joke lines get a literal sign) */
export const Sign: React.FC<{ pos: V3; text?: string; w?: number; h?: number; rotY?: number; board?: string }> = ({ pos, w = 1.6, h = 0.9, rotY = 0, board = "#e3b684" }) => (
  <group position={pos} rotation={[0, rotY, 0]}>
    <mesh position={[0, h / 2 + 0.8, 0]} castShadow>
      <boxGeometry args={[0.08, 1.6, 0.08]} />
      <primitive object={lam({ color: "#6e4a30" })} attach="material" />
    </mesh>
    <mesh position={[0, h + 0.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, 0.07]} />
      <primitive object={lam({ map: planksHD(), color: board })} attach="material" />
    </mesh>
  </group>
);

/** flat stone slab / rock (flat slabs, never polka-dot cobble grids — textures.md §3) */
export const Rock: React.FC<{ pos: V3; s?: V3; color?: string }> = ({ pos, s = [1.2, 0.7, 0.9], color = "#cabba8" }) => (
  <mesh position={pos} castShadow receiveShadow>
    <boxGeometry args={s} />
    <primitive object={lam({ map: stoneHD(), color })} attach="material" />
  </mesh>
);

/** generic plinth / low wall block */
export const Block: React.FC<{ pos: V3; s: V3; color?: string; tex?: () => THREE.Texture }> = ({ pos, s, color = "#f3e6d2", tex }) => (
  <mesh position={pos} castShadow receiveShadow>
    <boxGeometry args={s} />
    <primitive object={lam({ color, map: tex?.() ?? null })} attach="material" />
  </mesh>
);
