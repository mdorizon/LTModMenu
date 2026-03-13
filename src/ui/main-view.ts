import {
  mkHeader,
  mkItem,
  mkItemTag,
  bindNav,
  type RenderFn,
} from "./components";
import { renderDevTools } from "./dev-tools";
import { openSoundsModal } from "@features/sounds/ui/sounds-view";

const LINK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

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
    mkItem("lt-go-sounds", "Sounds", LINK_SVG) +
    "</div>";
  bindNav(() => renderMain(hud, pages), pages);
  document.getElementById("lt-go-sounds")!.onclick = () => openSoundsModal();
  renderDevTools(hud);
}
