import { mkHeader, bindNav, type RenderFn } from "../../ui/components";
import { getPos, getCurrentMap } from "../../core/game";
import { doInterMapTP } from "./teleport";
import { saveData } from "../../core/storage";
import { log } from "../../core/logger";

export function renderTP(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
): void {
  const wps = window.__waypoints || [];
  const wpList = wps
    .map(
      (w, i) =>
        '<div class="lt-wp-row">' +
        '<button class="lt-item" id="lt-wtp-' +
        i +
        '">' +
        "<span>" +
        w.name +
        "</span>" +
        '<span class="lt-sub">' +
        (w.map && w.map !== "unknown" ? w.map + " - " : "") +
        w.x +
        ", " +
        w.y +
        "</span>" +
        "</button>" +
        '<button class="lt-del" id="lt-wdel-' +
        i +
        '">X</button>' +
        "</div>",
    )
    .join("");

  hud.innerHTML =
    mkHeader("Waypoints", true) +
    '<div class="lt-body">' +
    (wpList || '<div class="lt-status">No waypoints saved</div>') +
    "</div>" +
    '<div class="lt-sep"></div>' +
    '<input class="lt-input" id="lt-wp-name" placeholder="Waypoint name...">' +
    '<button class="lt-action lt-primary" id="lt-wp-add">Save Current Position</button>' +
    '<div class="lt-status" id="lt-tp-status"></div>';
  bindNav(renderMainFn, pages);

  wps.forEach((w, i) => {
    document.getElementById("lt-wtp-" + i)!.onclick = () => {
      const result = doInterMapTP(w.x, w.y, w.direction || "down", w.map);
      const st = document.getElementById("lt-tp-status")!;
      st.textContent = result.success
        ? "Teleported to " + w.name
        : result.message;
      st.style.color = result.success ? "#5ad85a" : "#f05050";
    };
    document.getElementById("lt-wdel-" + i)!.onclick = () => {
      window.__waypoints.splice(i, 1);
      saveData("waypoints", window.__waypoints);
      renderTP(hud, renderMainFn, pages);
    };
  });

  document.getElementById("lt-wp-add")!.onclick = () => {
    const pos = getPos();
    const nameEl = document.getElementById("lt-wp-name") as HTMLInputElement;
    const name = (nameEl.value || "").trim() || "WP " + (wps.length + 1);
    const st = document.getElementById("lt-tp-status")!;
    if (pos) {
      window.__waypoints.push({
        name,
        x: pos.x,
        y: pos.y,
        direction: pos.direction || "down",
        map: getCurrentMap(),
      });
      saveData("waypoints", window.__waypoints);
      log("UI", "Waypoint saved: " + name + " " + pos.x + ", " + pos.y);
      renderTP(hud, renderMainFn, pages);
    } else {
      st.textContent = "Error: position unknown";
      st.style.color = "#e74c3c";
    }
  };
}
