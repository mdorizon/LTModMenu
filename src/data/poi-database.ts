export interface POI {
  name: string;
  x: number;
  y: number;
  map: string;
  direction?: string;
}

export const POI_DATA: POI[] = [
  // ── Main ──
  { name: "Concert", x: 538, y: 328, map: "main" },
  { name: "Lobby", x: 990, y: 757, map: "main" },
  { name: "Gaming-Setup", x: 1434, y: 1252, map: "main" },

  // ── Coffee Shop ──
  { name: "Coffee-shop", x: 701, y: 299, map: "coffee-shop" },

  // ── Fishing ──
  { name: "Pontoon", x: 497, y: 697, map: "fishing" },
  { name: "Fishing-pier", x: 45, y: 382, map: "fishing" },
  { name: "Harbor", x: 643, y: 215, map: "fishing" },

  // ── Fishing Shop ──
  { name: "Fishing-shop", x: 140, y: 234, map: "fishing-shop" },
];
