import { log } from "@core/logger";
import { getCurrentMap } from "@core/game";

const CART_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" fill="currentColor" viewBox="0 0 256 256" style="vertical-align:middle;"><path d="M230.14,58.87A8,8,0,0,0,224,56H62.68L56.6,22.57A8,8,0,0,0,48.73,16H24a8,8,0,0,0,0,16h18L67.56,172.29a24,24,0,0,0,5.33,11.27,28,28,0,1,0,44.4,8.44h45.42A27.75,27.75,0,0,0,160,204a28,28,0,1,0,28-28H91.17a8,8,0,0,1-7.87-6.57L80.13,152h116a24,24,0,0,0,23.61-19.71l12.16-66.86A8,8,0,0,0,230.14,58.87ZM104,204a12,12,0,1,1-12-12A12,12,0,0,1,104,204Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,200,204Z"></path></svg>';

export function renderFishShop(): string {
  return '<button class="lt-action lt-primary" id="lt-fish-shop" style="flex:0 0 auto;margin:0;width:auto;padding:10px 14px;display:flex;align-items:center;justify-content:center;">' + CART_ICON + '</button>';
}

export function bindFishShop(): void {
  const btn = document.getElementById("lt-fish-shop");
  if (!btn) return;

  btn.onclick = () => {
    log("UI", "Fish Shop opened from " + getCurrentMap());
    (window.__gameApp as any).onShowFishingInventory("sell");
  };
}
