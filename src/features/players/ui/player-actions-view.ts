import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { doTP } from "@features/teleport/teleport";
import type { TrackedPlayer } from "../player-tracker";

const SEAT_OFFSET = 10;

export function renderPlayerActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
  player: TrackedPlayer,
): void {
  hud.innerHTML =
    mkHeader(player.displayName, true) +
    '<div class="lt-body">' +
    '<div class="lt-player-info">' +
    '<span class="lt-sub">Position: ' +
    player.x +
    ", " +
    player.y +
    "</span>" +
    "</div>" +
    '<button class="lt-action lt-primary" id="lt-tp-to-player">Teleport to player</button>' +
    "</div>" +
    '<div class="lt-status" id="lt-player-status"></div>' +
    '<div class="lt-warn">Teleportation is detectable by the server</div>';

  bindNav(renderMainFn, pages);
  // Override back AFTER bindNav so it goes to players list
  const back = document.getElementById("lt-back");
  if (back) back.onclick = () => pages.players();

  document.getElementById("lt-tp-to-player")!.onclick = () => {
    const app = window.__gameApp;
    const live = app?.players?.[player.id];
    let x = live ? Math.round(live.currentPos.x) : player.x;
    let y = live ? Math.round(live.currentPos.y) : player.y;
    const dir = live?.direction || player.direction;

    // If player is seated, offset position to land below/beside the furniture
    const seatId = live?.currentSeatId;
    if (seatId) {
      x += SEAT_OFFSET;
      y += SEAT_OFFSET;
    }

    const ok = doTP(x, y, dir);
    const st = document.getElementById("lt-player-status")!;
    if (ok) {
      st.textContent =
        "Teleported near " + player.displayName + " (" + x + ", " + y + ")";
      if (seatId) st.textContent += " (seated, offset applied)";
      st.style.color = "#5ad85a";
    } else {
      st.textContent = "Error: gameApp not captured";
      st.style.color = "#f05050";
    }
  };
}
