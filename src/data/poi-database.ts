export interface POI {
  name: string;
  x: number;
  y: number;
  map: string;
  direction?: string;
}

export const POI_DATA: POI[] = [
  // ── Fishing ──
  { name: "Fishing Spot", x: 860, y: 380, map: "fishing" },
  { name: "Merchant", x: 793, y: 198, map: "fishing" },
];
