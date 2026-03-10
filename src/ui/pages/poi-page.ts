import { mkHeader, mkItem, bindNav, type RenderFn } from "../components";
import { doInterMapTP } from "../../game/player-actions";
import { POI_DATA } from "../../data/poi-database";

export function renderPOI(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const items = POI_DATA.map((p, i) =>
    mkItem(
      "lt-poi-" + i,
      p.name,
      '<span class="lt-sub">' + (p.map ? p.map + " - " : "") + p.x + ", " + p.y + "</span>",
    ),
  ).join("");

  hud.innerHTML =
    mkHeader("POIs", true) +
    '<div class="lt-body">' +
    items +
    "</div>" +
    '<div class="lt-status" id="lt-poi-status"></div>';
  bindNav(renderMainFn, pages);

  POI_DATA.forEach((p, i) => {
    document.getElementById("lt-poi-" + i)!.onclick = () => {
      const result = doInterMapTP(p.x, p.y, p.direction || "down", p.map);
      const st = document.getElementById("lt-poi-status")!;
      st.textContent = result.success
        ? "Teleported to " + p.name
        : result.message;
      st.style.color = result.success ? "#5ad85a" : "#f05050";
    };
  });
}
