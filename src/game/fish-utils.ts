import { FISH_DATA } from "../data/fish-database";

export function calculateGold(name: string, weight: number, isShiny: boolean): number {
  const info = FISH_DATA[name.toLowerCase()];
  if (!info) return 0;

  const ratio =
    info.maxWeight === info.minWeight
      ? 0
      : Math.max(0, Math.min(1, (weight - info.minWeight) / (info.maxWeight - info.minWeight)));

  let gold = Math.round(info.baseGold * (0.8 + ratio * 0.7));
  if (isShiny) gold *= 50;
  return gold;
}

export function getRarity(name: string): string {
  const info = FISH_DATA[name.toLowerCase()];
  return info ? info.rarity : "unknown";
}
