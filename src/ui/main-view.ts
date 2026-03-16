import {
  mkHeader,
  mkItem,
  bindNav,
  type RenderFn,
} from "./components";
import { iconExternalLink } from "./icons";
import { renderDevTools } from "./dev-tools";
import { openSoundsModal } from "@features/sounds/ui/sounds-view";

export function renderMain(
  hud: HTMLElement,
  pages: Record<string, RenderFn>,
): void {
  hud.innerHTML =
    mkHeader("LTModMenu", false, "v" + __VERSION__) +
    '<div class="lt-body">' +
    mkItem("lt-go-poi", "POIs") +
    mkItem("lt-go-tp", "Waypoints") +
    mkItem("lt-go-actions", "Actions") +
    mkItem("lt-go-players", "Players") +
    mkItem("lt-go-fish", "Fishing") +
    mkItem("lt-go-focus", "Focus") +
    mkItem("lt-go-missions", "Missions") +
    mkItem("lt-go-sounds", "Sounds", iconExternalLink()) +
    "</div>";
  bindNav(() => renderMain(hud, pages), pages);
  document.getElementById("lt-go-sounds")!.onclick = () => openSoundsModal();
  renderDevTools(hud);
}
