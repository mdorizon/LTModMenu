import { log } from "@core/logger";
import { getCurrentMap } from "@core/game";
import { iconCart } from "@ui/icons";

export function renderFishShop(): string {
  return '<button class="lt-action lt-primary" id="lt-fish-shop" style="flex:0 0 auto;margin:0;width:auto;padding:7px 10px;display:flex;align-items:center;justify-content:center;">' + iconCart(16) + '</button>';
}

export function bindFishShop(): void {
  const btn = document.getElementById("lt-fish-shop");
  if (!btn) return;

  btn.onclick = () => {
    log("UI", "Fish Shop opened from " + getCurrentMap());
    (window.__gameApp as any).onShowFishingInventory("sell");
  };
}
