import {
  mkHeader,
  mkItem,
  mkItemTag,
  bindNav,
  type RenderFn,
} from "./components";
import { renderDevTools } from "./dev-tools";

export function renderMain(
  hud: HTMLElement,
  pages: Record<string, RenderFn>,
): void {
  hud.innerHTML =
    mkHeader("LTModMenu") +
    '<div class="lt-body">' +
    mkItemTag("lt-go-poi", "POIs", "DETECTABLE") +
    mkItemTag("lt-go-tp", "Waypoints", "DETECTABLE") +
    mkItemTag("lt-go-actions", "Actions", "DETECTABLE") +
    mkItem("lt-go-fish", "Fishing") +
    "</div>";
  bindNav(() => renderMain(hud, pages), pages);
  renderDevTools(hud);
}
