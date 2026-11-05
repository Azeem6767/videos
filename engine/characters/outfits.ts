// engine/characters/outfits.ts — outfit presets (characters.md §2.9 style; pirate cast for the first scene)
import { INK, SKINS } from "./pen";

export type Build = "adult" | "stout" | "kid";
export type HatKind = "shako" | "shako_tall" | "cap" | "hair" | "tophat" | "bonnet" | "tricorn" | "bandana" | null;

export type Outfit = {
  build?: Build;
  skin?: string;
  jacket: string; // torso bean fill
  pants: string; // leg strokes
  boots?: string; // foot strokes (INK by default)
  hat?: HatKind;
  capColor?: string; // cap / bandana / tricorn / tophat colour
  hairColor?: string;
  belt?: string; // cross belts
  buttons?: string;
  sash?: string; // horizontal band clipped to the torso
  moustache?: string; // colour, draws a handlebar moustache
};

export const RIFLEMAN: Outfit = {
  build: "adult", skin: SKINS[0], jacket: "#357650", pants: "#3d4440", boots: INK,
  hat: "shako", belt: "#f1efe6", buttons: "#d9dde0",
};
export const OFFICER: Outfit = {
  build: "stout", skin: SKINS[1], jacket: "#357650", pants: "#3d4440", boots: INK,
  hat: "shako_tall", buttons: "#e8c45a", sash: "#c0353a", moustache: "#4a3020",
};
export const KID: Outfit = {
  build: "kid", skin: SKINS[2], jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea",
  hat: "cap", capColor: "#e2453c",
};
export const PARENT: Outfit = {
  build: "adult", skin: SKINS[3], jacket: "#7b5ac9", pants: "#4a3b34", boots: "#5a3b2a", hat: "hair",
};

// ---- pirate scene cast ----
export const CAPTAIN: Outfit = {
  build: "adult", skin: SKINS[1], jacket: "#8a2f3c", pants: "#2c2f3a", boots: INK,
  hat: "tricorn", capColor: "#33313b", sash: "#e8c45a", buttons: "#e8c45a", moustache: "#2a201a",
};
export const CREW_A: Outfit = {
  build: "adult", skin: SKINS[0], jacket: "#d8cdb4", pants: "#3b4252", boots: INK, hat: "bandana", capColor: "#c0353a",
};
export const CREW_B: Outfit = {
  build: "adult", skin: SKINS[2], jacket: "#4a6fa5", pants: "#33302c", boots: INK, hat: "bandana", capColor: "#31456b",
};
export const CREW_C: Outfit = {
  build: "stout", skin: SKINS[3], jacket: "#5b7a4a", pants: "#3b4252", boots: INK, hat: "cap", capColor: "#6b4a2f",
};
export const TOWNSFOLK: Outfit = {
  build: "adult", skin: SKINS[0], jacket: "#a98f5a", pants: "#4a4238", boots: "#5a3b2a", hat: "tophat",
};
