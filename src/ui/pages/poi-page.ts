import { mkHeader, mkItem, bindNav, type RenderFn } from "../components";
import { doTP } from "../../game/player-actions";

const POI = [
  { name: "Fishing Spot", x: 860, y: 380 },
  { name: "Merchant", x: 793, y: 198 },
];

export function renderPOI(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const items = POI.map((p, i) =>
    mkItem(
      "lt-poi-" + i,
      p.name,
      '<span class="lt-sub">' + p.x + ", " + p.y + "</span>",
    ),
  ).join("");

  hud.innerHTML =
    mkHeader("POIs", true) +
    '<div class="lt-body">' +
    items +
    "</div>" +
    '<div class="lt-status" id="lt-poi-status"></div>';
  bindNav(renderMainFn, pages);

  POI.forEach((p, i) => {
    document.getElementById("lt-poi-" + i)!.onclick = () => {
      const ok = doTP(p.x, p.y, "down");
      const st = document.getElementById("lt-poi-status")!;
      st.textContent = ok
        ? "Teleported to " + p.name
        : "Error: gameApp not captured";
      st.style.color = ok ? "#5ad85a" : "#f05050";
    };
  });
}
