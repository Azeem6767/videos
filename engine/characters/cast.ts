// engine/characters/cast.ts — sprite pool: camera-facing billboard planes with cached Canvas2D
// drawings (characters.md §1.1). Each character = a plane whose texture is drawn once per
// pose/expression/light and cached, so the draw cost is paid once, not per frame.
// No emissive: the cards are shaded by the scene light (lighting.md §9.5 cardShade).
import * as THREE from "three";
import { Pen } from "./pen";
import { bodyFrontV2, bodySide, type FrontOpts, type SideOpts } from "./body";
import type { Outfit, Build } from "./outfits";
import { rad } from "../core/util";

const cache = new Map<string, THREE.CanvasTexture>();

const key = (o: Outfit, pose: string, expr: string, light: number, facing: number, seed: number, side: boolean) =>
  `${o.jacket}|${o.pants}|${o.build}|${o.hat}|${o.capColor}|${o.belt}|${o.sash}|${o.buttons}|${o.moustache}|${pose}|${expr}|${light.toFixed(3)}|${facing}|${seed}|${side}`;

function draw(o: Outfit, opts: FrontOpts | SideOpts, side: boolean, light: number, facing: number, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 600; canvas.height = 1000;
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, 600, 1000);
  const p = new Pen(g);
  if (side) bodySide(p, o, { light, facing: facing as 1 | -1, seed, ...opts } as SideOpts);
  else bodyFrontV2(p, o, { light, facing: facing as -1 | 0 | 1, seed, ...opts } as FrontOpts);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function sprite(o: Outfit, opts: FrontOpts | SideOpts, side: boolean, light: number, facing: number, seed: number): THREE.CanvasTexture {
  const k = key(o, String(opts.phase ?? 0), opts.expr ?? "neutral", light, facing, seed, side);
  let t = cache.get(k);
  if (!t) { t = draw(o, opts, side, light, facing, seed); cache.set(k, t); }
  return t;
}

/** camera-facing billboard plane. Faces the camera; picks front or side view per key (stable
 *  during glides, so a soldier never pops mid-move — motion.md §5.1e). */
export class Actor {
  id: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  dmat: THREE.MeshDepthMaterial;
  tex?: THREE.CanvasTexture;
  pos: [number, number, number];
  build: Build;
  outfit: Outfit;
  seed: number;
  facing: number;

  constructor(id: number, outfit: Outfit, pos: [number, number, number], build: Build = "adult", seed = 1) {
    this.id = id; this.outfit = outfit; this.pos = pos; this.build = build; this.seed = seed; this.facing = 0;
    const geom = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshLambertMaterial({ map: null, alphaTest: 0.5, side: THREE.DoubleSide });
    this.dmat = new THREE.MeshDepthMaterial({ colorWrite: false });
    this.mesh = new THREE.Mesh(geom, this.mat);
    this.mesh.position.set(...pos);
    this.mesh.renderOrder = 1; // drawn after the contact blobs (world.ts)
    this.mesh.layers.set(3); // NOINK: billboards get no rectangle outline, no holes in world lines
    this.mesh.castShadow = false;
  }

  /** re-face the billboard toward the camera; stable view chosen per key, not per frame */
  face(cam: THREE.PerspectiveCamera, keyEnd: number) {
    const dx = cam.position.x - this.pos[0], dz = cam.position.z - this.pos[2];
    const dir = Math.sign(dz) || Math.sign(dx) || 1;
    const yaw = Math.atan2(dx, dz); // 0 = facing +z
    const side = Math.abs(Math.sin(yaw)) > Math.abs(Math.cos(yaw)); // true = side view
    const facing = Math.sign(Math.cos(yaw));
    const f = facing as -1 | 0 | 1;
    this.facing = f;
    this.mesh.rotation.y = yaw;
    this.mesh.scale.set(side ? 0.5 : 1, 1, side ? 0.5 : 1);
  }

  /** draw this card's pose (front or side) into its texture, cached */
  bind(opts: FrontOpts | SideOpts, side: boolean, light: number) {
    this.tex = sprite(this.outfit, opts, side, light, this.facing, this.seed);
    this.mat.map = this.tex;
    this.dmat.map = this.tex;
  }

  /** world-space position of the card's feet (design canvas y=975 = sole) */
  feet(): [number, number, number] { return this.pos; }
}