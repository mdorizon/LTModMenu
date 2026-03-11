import { log } from "@core/logger";
import { getCurrentMap } from "@core/game";

export function renderFishShop(): string {
  return '<div class="lt-sep"></div><button class="lt-action lt-primary" id="lt-fish-shop">Fish Shop</button>';
}

export function bindFishShop(): void {
  const btn = document.getElementById("lt-fish-shop");
  if (!btn) return;

  btn.onclick = () => {
    log("UI", "Fish Shop opened from " + getCurrentMap());
    (window.__gameApp as any).onShowFishingInventory("sell");
  };
}
