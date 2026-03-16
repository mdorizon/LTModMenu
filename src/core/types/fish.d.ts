export interface LastFishInfo {
  name: string;
  rarity: string;
  weight: number;
  gold: number;
  isShiny: boolean;
}

export interface FishStats {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  secret: number;
  event: number;
  shiny: number;
  unknown: number;
  total: number;
  gold: number;
  last_fish: LastFishInfo | null;
  [key: string]: number | string | LastFishInfo | null;
}

export interface FishBiteData {
  challenge?: string;
  [key: string]: unknown;
}

export interface FishResultData {
  id?: string;
  name?: string;
  weight?: number;
  isShiny?: boolean;
  [key: string]: unknown;
}
