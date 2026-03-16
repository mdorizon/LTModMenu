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
  last_fish: string;
  [key: string]: number | string;
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
