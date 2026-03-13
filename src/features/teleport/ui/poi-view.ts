import { mkHeader, mkItem, mkActionSelect, bindNav, type RenderFn } from "@ui/components";
import { doInterMapTP } from "../teleport";
import { mkLobbyButton, bindLobbyButton } from "@features/lobbies/lobby-switch";
import { POI_DATA } from "../data/poi-database";
import { getOwnBurrows, getPreferredBurrowId, setPreferredBurrowId, visitOwnBurrow } from "../burrow-visit";

function mkGoHome(): string {
  const burrows = getOwnBurrows();
  if (burrows.length === 0) return "";

  if (burrows.length === 1) {
    return '<button class="lt-action lt-primary" id="lt-go-home">Go Home</button>';
  }

  const preferredId = getPreferredBurrowId();
  return mkActionSelect(
    "lt-go-home", "Go Home", "lt-burrow-select",
    burrows.map((b, i) => ({ value: b.id, label: b.template, selected: b.id === preferredId || (!preferredId && i === 0) })),
  );
}

export function renderPOI(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const burrows = getOwnBurrows();
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
    mkLobbyButton() +
    mkGoHome() +
    '<div class="lt-sep"></div>' +
    items +
    "</div>" +
    '<div class="lt-status" id="lt-poi-status"></div>';
  bindNav(renderMainFn, pages);
  bindLobbyButton("lt-poi-status");

  const goHomeEl = document.getElementById("lt-go-home");
  if (goHomeEl) {
    goHomeEl.onclick = () => {
      const st = document.getElementById("lt-poi-status")!;
      const select = document.getElementById("lt-burrow-select") as HTMLSelectElement | null;
      const result = visitOwnBurrow(select?.value || undefined);
      st.textContent = result.message;
      st.style.color = result.success ? "#5ad85a" : "#f05050";
    };
  }

  const burrowSelect = document.getElementById("lt-burrow-select") as HTMLSelectElement | null;
  if (burrowSelect) {
    burrowSelect.onclick = (e) => e.stopPropagation();
    burrowSelect.onchange = () => setPreferredBurrowId(burrowSelect.value);
  }

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
