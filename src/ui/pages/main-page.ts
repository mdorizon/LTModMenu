import { mkHeader, mkItem, mkItemTag, bindNav, type RenderFn } from "../components";

export function renderMain(hud: HTMLElement, pages: Record<string, RenderFn>): void {
  hud.innerHTML =
    mkHeader("LTModMenu") +
    '<div class="lt-body">' +
    mkItemTag("lt-go-poi", "Saved Locations", "DETECT") +
    mkItemTag("lt-go-tp", "Teleport Options", "DETECT") +
    mkItemTag("lt-go-actions", "Player Actions", "DETECT") +
    mkItem("lt-go-fish", "Auto Fishing") +
    "</div>";
  bindNav(() => renderMain(hud, pages), pages);
}
