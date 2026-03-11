import { log } from "@core/logger";

export interface FishInfo {
  rarity: string;
  minWeight: number;
  maxWeight: number;
  baseGold: number;
}

export const FISH_DATA: Record<string, FishInfo> = {
  // ── Common ──
  bass: { rarity: "common", minWeight: 1, maxWeight: 8, baseGold: 8 },
  cod: { rarity: "common", minWeight: 2, maxWeight: 15, baseGold: 10 },
  shrimp: { rarity: "common", minWeight: 0.1, maxWeight: 0.5, baseGold: 5 },
  sardine: { rarity: "common", minWeight: 0.2, maxWeight: 1, baseGold: 6 },
  anchovy: { rarity: "common", minWeight: 0.1, maxWeight: 0.3, baseGold: 5 },
  flounder: { rarity: "common", minWeight: 1, maxWeight: 5, baseGold: 7 },
  "star fish": { rarity: "common", minWeight: 0.2, maxWeight: 2, baseGold: 6 },
  "sea urchin": { rarity: "common", minWeight: 0.5, maxWeight: 3, baseGold: 8 },
  catfish: { rarity: "common", minWeight: 2, maxWeight: 20, baseGold: 12 },
  herring: { rarity: "common", minWeight: 0.5, maxWeight: 2, baseGold: 7 },
  mackerel: { rarity: "common", minWeight: 1, maxWeight: 4, baseGold: 9 },
  lobster: { rarity: "common", minWeight: 0.45, maxWeight: 5, baseGold: 8 },

  // ── Uncommon ──
  "puffer fish": { rarity: "uncommon", minWeight: 0.5, maxWeight: 3, baseGold: 18 },
  trevally: { rarity: "uncommon", minWeight: 3, maxWeight: 25, baseGold: 22 },
  oyster: { rarity: "uncommon", minWeight: 0.3, maxWeight: 2, baseGold: 15 },
  tetra: { rarity: "uncommon", minWeight: 0.1, maxWeight: 0.5, baseGold: 16 },
  tuna: { rarity: "uncommon", minWeight: 20, maxWeight: 400, baseGold: 35 },
  eel: { rarity: "uncommon", minWeight: 2, maxWeight: 25, baseGold: 25 },
  "moorish idol": { rarity: "uncommon", minWeight: 0.5, maxWeight: 2, baseGold: 20 },
  salmon: { rarity: "uncommon", minWeight: 5, maxWeight: 30, baseGold: 28 },
  seahorse: { rarity: "uncommon", minWeight: 0.1, maxWeight: 1, baseGold: 17 },
  "clown fish": { rarity: "uncommon", minWeight: 0.2, maxWeight: 1, baseGold: 19 },
  squid: { rarity: "uncommon", minWeight: 1, maxWeight: 15, baseGold: 24 },

  // ── Rare ──
  goldfish: { rarity: "rare", minWeight: 0.5, maxWeight: 2, baseGold: 45 },
  "koi carp": { rarity: "rare", minWeight: 2, maxWeight: 35, baseGold: 55 },
  "ribbon moray": { rarity: "rare", minWeight: 5, maxWeight: 40, baseGold: 60 },
  blobfish: { rarity: "rare", minWeight: 2, maxWeight: 20, baseGold: 50 },
  "flying fish": { rarity: "rare", minWeight: 1, maxWeight: 5, baseGold: 42 },
  coelacanth: { rarity: "rare", minWeight: 15, maxWeight: 180, baseGold: 75 },
  stingray: { rarity: "rare", minWeight: 10, maxWeight: 800, baseGold: 65 },

  // ── Epic ──
  "blue lobster": { rarity: "epic", minWeight: 1, maxWeight: 9, baseGold: 120 },
  "fried egg jellyfish": { rarity: "epic", minWeight: 5, maxWeight: 35, baseGold: 95 },
  "tiger shark": { rarity: "epic", minWeight: 200, maxWeight: 1400, baseGold: 180 },
  "manta ray": { rarity: "epic", minWeight: 600, maxWeight: 5000, baseGold: 200 },
  marlin: { rarity: "epic", minWeight: 100, maxWeight: 1800, baseGold: 175 },
  octopus: { rarity: "epic", minWeight: 5, maxWeight: 150, baseGold: 110 },
  "hammer shark": { rarity: "epic", minWeight: 500, maxWeight: 1200, baseGold: 165 },
  "whale shark": { rarity: "epic", minWeight: 15000, maxWeight: 40000, baseGold: 220 },
  "lion fish": { rarity: "epic", minWeight: 1, maxWeight: 5, baseGold: 85 },
  "sun fish": { rarity: "epic", minWeight: 500, maxWeight: 5000, baseGold: 190 },
  "horseshoe crab": { rarity: "epic", minWeight: 2, maxWeight: 10, baseGold: 100 },

  // ── Legendary ──
  "white lobster": { rarity: "legendary", minWeight: 1, maxWeight: 15, baseGold: 400 },
  "golden goldfish": { rarity: "legendary", minWeight: 2, maxWeight: 8, baseGold: 500 },
  "phantom jellyfish": { rarity: "legendary", minWeight: 10, maxWeight: 100, baseGold: 500 },
  "ocean man": { rarity: "legendary", minWeight: 150, maxWeight: 250, baseGold: 750 },
  "sperm whale": { rarity: "legendary", minWeight: 25000, maxWeight: 125000, baseGold: 800 },
  "mermaid?": { rarity: "legendary", minWeight: 100, maxWeight: 180, baseGold: 800 },
  cthulhu: { rarity: "legendary", minWeight: 50000, maxWeight: 200000, baseGold: 1000 },
  mermaid: { rarity: "legendary", minWeight: 110, maxWeight: 170, baseGold: 900 },
  megalodon: { rarity: "legendary", minWeight: 50000, maxWeight: 120000, baseGold: 900 },
  "giant squid": { rarity: "legendary", minWeight: 600, maxWeight: 1500, baseGold: 750 },

  // ── Secret ──
  "red handfish": { rarity: "secret", minWeight: 0.04, maxWeight: 0.1, baseGold: 1500 },
  "goblin shark": { rarity: "secret", minWeight: 23, maxWeight: 210, baseGold: 1500 },
  "ghost shark": { rarity: "secret", minWeight: 1, maxWeight: 16, baseGold: 1750 },
  "black seadevil anglerfish": { rarity: "secret", minWeight: 0.05, maxWeight: 1, baseGold: 1500 },
  "devil's hole pupfish": { rarity: "secret", minWeight: 0.01, maxWeight: 0.02, baseGold: 2000 },
  "barreleye fish": { rarity: "secret", minWeight: 1, maxWeight: 5, baseGold: 1500 },
  "gulper eel": { rarity: "secret", minWeight: 2, maxWeight: 10, baseGold: 1500 },

  // ── Halloween ──
  "vampire squid": { rarity: "halloween", minWeight: 5, maxWeight: 30, baseGold: 75 },
  "bobbit worm": { rarity: "halloween", minWeight: 10, maxWeight: 100, baseGold: 100 },
  siren: { rarity: "halloween", minWeight: 100, maxWeight: 200, baseGold: 150 },
  nessie: { rarity: "halloween", minWeight: 1000, maxWeight: 10000, baseGold: 180 },
  "skeleton fish": { rarity: "halloween", minWeight: 1, maxWeight: 10, baseGold: 60 },
  "the great angler": { rarity: "halloween", minWeight: 500, maxWeight: 5000, baseGold: 200 },

  // ── Christmas ──
  "pinecone fish": { rarity: "christmas", minWeight: 1, maxWeight: 5, baseGold: 75 },
  "garden eel": { rarity: "christmas", minWeight: 2, maxWeight: 15, baseGold: 100 },
  "ornated jelly fish": { rarity: "christmas", minWeight: 5, maxWeight: 30, baseGold: 150 },
  "fish-deer": { rarity: "christmas", minWeight: 50, maxWeight: 200, baseGold: 180 },
  walrus: { rarity: "christmas", minWeight: 500, maxWeight: 1500, baseGold: 200 },
  narwhal: { rarity: "christmas", minWeight: 800, maxWeight: 3500, baseGold: 250 },
};

log("DATA", "Fish database loaded: " + Object.keys(FISH_DATA).length + " fish");
