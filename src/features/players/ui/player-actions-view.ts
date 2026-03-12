import { mkHeader, bindNav, type RenderFn } from "@ui/components";
import { doTP } from "@features/teleport/teleport";
import { log } from "@core/logger";
import type { TrackedPlayer } from "../player-tracker";
import {
  PRIVACY_PUBLIC,
  PRIVACY_FRIENDS,
  BURROW_SPAWN_OFFSET_X,
  FALLBACK_SPAWN,
  FALLBACK_SCENE,
  JOIN_TIMEOUT_MS,
} from "../data/burrow-database";

const SEAT_OFFSET = 10;

function getBurrowState(player: TrackedPlayer): { canVisit: boolean; label: string } {
  const burrow = player.activeBurrow;
  if (!burrow?.id) return { canVisit: false, label: "No burrow available" };
  if (burrow.privacyLevel === PRIVACY_PUBLIC) return { canVisit: true, label: "Visit burrow" };
  if (burrow.privacyLevel === PRIVACY_FRIENDS && player.isFriend) return { canVisit: true, label: "Visit burrow (friend)" };
  if (burrow.privacyLevel === PRIVACY_FRIENDS) return { canVisit: false, label: "Burrow is friends only" };
  return { canVisit: false, label: "Burrow is private" };
}

export function renderPlayerActions(
  hud: HTMLElement,
  renderMainFn: RenderFn,
  pages: Record<string, RenderFn>,
  player: TrackedPlayer,
): void {
  const burrow = player.activeBurrow;
  const { canVisit, label: burrowLabel } = getBurrowState(player);

  const subtitle = (player.username && player.username !== player.displayName ? "@" + player.username + " &middot; " : "") +
    player.x + ", " + player.y +
    (player.isFriend ? " &middot; Friend" : "");

  hud.innerHTML =
    mkHeader(player.displayName, true) +
    '<div class="lt-body">' +
    '<div class="lt-player-info">' +
    '<span class="lt-sub">' + subtitle + "</span>" +
    "</div>" +
    '<button class="lt-action lt-primary" id="lt-tp-to-player">Teleport to player</button>' +
    '<button class="lt-action' +
    (canVisit ? " lt-primary" : " lt-muted") +
    '" id="lt-visit-burrow"' +
    (canVisit ? "" : " disabled") +
    ">" +
    burrowLabel +
    "</button>" +
    "</div>" +
    '<div class="lt-status" id="lt-player-status"></div>' +
    '<div class="lt-warn">Teleportation is detectable by the server</div>';

  bindNav(renderMainFn, pages);
  const back = document.getElementById("lt-back");
  if (back) back.onclick = () => pages.players();

  document.getElementById("lt-tp-to-player")!.onclick = () => {
    const app = window.__gameApp;
    const live = app?.players?.[player.id];
    let x = live ? Math.round(live.currentPos.x) : player.x;
    let y = live ? Math.round(live.currentPos.y) : player.y;
    const dir = live?.direction || player.direction;

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

  if (canVisit) {
    document.getElementById("lt-visit-burrow")!.onclick = () => {
      const app = window.__gameApp;
      const st = document.getElementById("lt-player-status")!;
      if (!app?.loadScene) {
        st.textContent = "Error: gameApp not captured";
        st.style.color = "#f05050";
        return;
      }

      const template = burrow!.template;
      const cached = window.__sceneCache?.get(template);
      const scene = cached || { name: template, ...FALLBACK_SCENE };

      log("BURROW", "Visiting " + player.displayName + " burrow=" + burrow!.id + " template=" + template + " cached=" + !!cached);

      const spawn = scene.fastTravelSpawnPosition || FALLBACK_SPAWN;
      app.loadScene({
        scene,
        burrow: { id: burrow!.id, subRoom: 0 },
        position: { x: spawn.x + BURROW_SPAWN_OFFSET_X, y: spawn.y, direction: spawn.direction },
      });

      st.textContent = "Joining " + player.displayName + "'s burrow...";
      st.style.color = "#5ad85a";

      const expectedRoom = "burrow:" + burrow!.id + ":0";
      const timeout = setTimeout(() => {
        const currentRoom = app.currentServerRoomId;
        if (currentRoom === expectedRoom) return;
        log("BURROW", "Timeout: server did not confirm join (current=" + currentRoom + " expected=" + expectedRoom + "), recovering");
        st.textContent = "Failed to join burrow";
        st.style.color = "#f05050";
        if (app.backToMainScene) {
          app.backToMainScene();
        }
      }, JOIN_TIMEOUT_MS);

      const ws = window.__gameWS;
      if (ws) {
        const onMsg = (e: MessageEvent) => {
          if (typeof e.data === "string" && e.data.includes(expectedRoom)) {
            clearTimeout(timeout);
            ws.removeEventListener("message", onMsg);
          }
        };
        ws.addEventListener("message", onMsg);
      }
    };
  }
}
