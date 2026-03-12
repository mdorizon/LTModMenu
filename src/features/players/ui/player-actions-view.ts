import { mkHeader, bindNav, showTransitionOverlay, type RenderFn } from "@ui/components";
import { doTP, doInterMapTP } from "@features/teleport/teleport";
import { log } from "@core/logger";
import { getCurrentLobby, switchLobby } from "@core/game";
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
const SWITCH_POLL_MS = 300;
const SWITCH_TIMEOUT_MS = 15000;

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

  const isOffMap = !!player.offMap;
  const friendPresence = window.__friendIds.get(player.id);
  const friendLobby = friendPresence?.lobby || "";
  const currentLobby = getCurrentLobby();
  const isCrossLobby = isOffMap && !!friendLobby && friendLobby !== currentLobby;
  const playerRoom = window.__playerRooms.get(player.id) || "";
  const isSameLobbyDiffRoom = isOffMap && !isCrossLobby && !!playerRoom;

  const locationLabel = isCrossLobby
    ? friendLobby
    : isSameLobbyDiffRoom
      ? playerRoom.startsWith("burrow:") ? "burrow" : playerRoom
      : isOffMap ? (friendLobby || "another map") : player.x + ", " + player.y;
  const subtitle = (player.username && player.username !== player.displayName ? "@" + player.username + " &middot; " : "") +
    locationLabel +
    (player.isFriend ? " &middot; Friend" : "");

  let tpButtonHtml: string;
  if (isCrossLobby) {
    tpButtonHtml = '<button class="lt-action lt-primary" id="lt-tp-to-player">Switch to ' + friendLobby + "</button>";
  } else if (isSameLobbyDiffRoom) {
    const roomLabel = playerRoom.startsWith("burrow:") ? "burrow" : playerRoom;
    tpButtonHtml = '<button class="lt-action lt-primary" id="lt-tp-to-player">Go to ' + roomLabel + "</button>";
  } else if (isOffMap) {
    tpButtonHtml = '<button class="lt-action lt-muted" disabled id="lt-tp-to-player">Player location unknown</button>';
  } else {
    tpButtonHtml = '<button class="lt-action lt-primary" id="lt-tp-to-player">Teleport to player</button>';
  }

  hud.innerHTML =
    mkHeader(player.displayName, true) +
    '<div class="lt-body">' +
    '<div class="lt-player-info">' +
    '<span class="lt-sub">' + subtitle + "</span>" +
    "</div>" +
    tpButtonHtml +
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
    const st = document.getElementById("lt-player-status")!;

    if (isCrossLobby) {
      const ok = switchLobby(friendLobby);
      if (!ok) {
        st.textContent = "Error: WebSocket not ready";
        st.style.color = "#f05050";
        return;
      }
      st.textContent = "Switching to " + friendLobby + "...";
      st.style.color = "#c8c0e0";
      const dismissOverlay = showTransitionOverlay();

      const friendId = player.id;
      const friendName = player.displayName;
      const start = Date.now();
      let navigated = false;
      let overlayDismissed = false;

      const fadeOut = () => {
        if (!overlayDismissed) { overlayDismissed = true; dismissOverlay(); }
      };

      const poll = setInterval(() => {
        const elapsed = Date.now() - start;
        const stEl = document.getElementById("lt-player-status");
        if (!stEl || elapsed > SWITCH_TIMEOUT_MS) {
          clearInterval(poll);
          fadeOut();
          if (stEl) {
            stEl.textContent = elapsed > SWITCH_TIMEOUT_MS
              ? "Joined " + friendLobby + " — couldn't locate " + friendName
              : "";
            stEl.style.color = "#c8c0e0";
          }
          return;
        }

        // Step 1: wait for lobby connection
        if (window.__currentLobby !== friendLobby) return;

        // Step 2: friend on current map? → TP directly
        const app = window.__gameApp;
        const live = app?.players?.[friendId];
        if (live) {
          clearInterval(poll);
          const x = Math.round(live.currentPos.x);
          const y = Math.round(live.currentPos.y);
          const dir = live.direction || "left";
          doTP(x, y, dir);
          fadeOut();
          stEl.textContent = "Teleported to " + friendName + " (" + x + ", " + y + ")";
          stEl.style.color = "#5ad85a";
          return;
        }

        // Step 3: know their room? → navigate there (once)
        if (!navigated) {
          const room = window.__playerRooms.get(friendId);
          if (room) {
            navigated = true;
            fadeOut();
            if (room.startsWith("burrow:")) {
              const parts = room.split(":");
              const burrowId = parts[1];
              const subRoom = parseInt(parts[2] || "0", 10);
              const template = player.activeBurrow?.template || "burrow-1";
              const cached = window.__sceneCache?.get(template);
              const scene = cached || { name: template, ...FALLBACK_SCENE };
              const spawn = scene.fastTravelSpawnPosition || FALLBACK_SPAWN;
              log("BURROW", "Cross-lobby follow → burrow=" + burrowId);
              app?.loadScene?.({
                scene,
                burrow: { id: burrowId, subRoom },
                position: { x: spawn.x + BURROW_SPAWN_OFFSET_X, y: spawn.y, direction: spawn.direction },
              });
              stEl.textContent = "Joining " + friendName + "'s burrow...";
            } else {
              const cached = window.__sceneCache?.get(room);
              const spawn = cached?.fastTravelSpawnPosition || FALLBACK_SPAWN;
              log("TP", "Cross-lobby follow → room=" + room);
              doInterMapTP(spawn.x, spawn.y, spawn.direction, room);
              stEl.textContent = "Navigating to " + room + "...";
            }
            stEl.style.color = "#c8c0e0";
          } else if (!app?.loadingScene) {
            fadeOut();
            stEl.textContent = "Connected to " + friendLobby + " — locating " + friendName + "...";
          }
        }
      }, SWITCH_POLL_MS);
      return;
    }

    if (isSameLobbyDiffRoom) {
      if (playerRoom.startsWith("burrow:")) {
        // Burrow visit: extract burrow ID from room string "burrow:<uuid>:<subRoom>"
        const parts = playerRoom.split(":");
        const burrowId = parts[1];
        const subRoom = parseInt(parts[2] || "0", 10);
        const app = window.__gameApp;
        if (!app?.loadScene) {
          st.textContent = "Error: gameApp not captured";
          st.style.color = "#f05050";
          return;
        }
        const template = player.activeBurrow?.template || "burrow-1";
        const cached = window.__sceneCache?.get(template);
        const scene = cached || { name: template, ...FALLBACK_SCENE };
        const spawn = scene.fastTravelSpawnPosition || FALLBACK_SPAWN;
        log("BURROW", "Following " + player.displayName + " to burrow=" + burrowId + " room=" + playerRoom);
        app.loadScene({
          scene,
          burrow: { id: burrowId, subRoom },
          position: { x: spawn.x + BURROW_SPAWN_OFFSET_X, y: spawn.y, direction: spawn.direction },
        });
        st.textContent = "Joining " + player.displayName + "'s room...";
        st.style.color = "#5ad85a";
      } else {
        // Regular map: use doInterMapTP with default spawn
        const cached = window.__sceneCache?.get(playerRoom);
        const spawn = cached?.fastTravelSpawnPosition || FALLBACK_SPAWN;
        log("TP", "Following " + player.displayName + " to room=" + playerRoom);
        const result = doInterMapTP(spawn.x, spawn.y, spawn.direction, playerRoom);
        st.textContent = result.message;
        st.style.color = result.success ? "#5ad85a" : "#f05050";
      }
      return;
    }

    if (player.offMap) return;
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
