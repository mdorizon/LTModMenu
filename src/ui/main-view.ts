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
    mkHeader("LTModMenu", false, "v" + __VERSION__) +
    '<div class="lt-body">' +
    mkItemTag("lt-go-poi", "POIs", "DETECTABLE") +
    mkItemTag("lt-go-tp", "Waypoints", "DETECTABLE") +
    mkItemTag("lt-go-actions", "Actions", "DETECTABLE") +
    mkItemTag("lt-go-players", "Players", "DETECTABLE") +
    mkItem("lt-go-fish", "Fishing") +
    mkItem("lt-go-focus", "Focus") +
    mkItem("lt-go-missions", "Missions") +
    "</div>";
  bindNav(() => renderMain(hud, pages), pages);
  renderDevTools(hud);
}
