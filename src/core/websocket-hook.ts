// Side-effect module: replaces window.WebSocket to intercept all connections

import { log, logWsAll } from "./logger";

if (!window.__playerProfiles) {
  window.__playerProfiles = new Map();
}

function extractPlayerProfiles(eventName: string, eventData: any): void {
  const profiles = window.__playerProfiles;
  try {
    if (eventName === "initOtherPlayers" && eventData?.playerStates) {
      for (const ps of eventData.playerStates) {
        if (ps.id && ps.profile) {
          profiles.set(ps.id, {
            displayName: ps.profile.displayName || ps.profile.username || "",
            username: ps.profile.username || "",
          });
        }
      }
      log("WS", "Profiles loaded: " + profiles.size + " players");
    }

    if (eventName === "playerJoinedRoom" && eventData?.id && eventData?.profile) {
      profiles.set(eventData.id, {
        displayName: eventData.profile.displayName || eventData.profile.username || "",
        username: eventData.profile.username || "",
      });
    }

    if (eventName === "playerDisconnected" || eventName === "playerLeftRoom") {
      const id = typeof eventData === "string" ? eventData : eventData?.id;
      if (id) profiles.delete(id);
    }
  } catch (_e) {
    // ignore parse errors
  }
}

log("WS", "Setting up WebSocket hook...");
const OrigWS = window.WebSocket;
log("WS", "Original WebSocket: " + typeof OrigWS);

(window as any).WebSocket = function (...args: any[]) {
  const url = args[0] || "";
  log("WS", "new WebSocket() called, url: " + url);

  const ws = new (Function.prototype.bind.apply(OrigWS, [
    null,
    ...args,
  ]) as any)() as WebSocket;
  log("WS", "WebSocket created, readyState: " + ws.readyState);

  if (typeof url === "string") {
    window.__gameWS = ws;
    log("WS", "Stored as __gameWS");

    // Hook send
    const _origSend = ws.send.bind(ws);
    ws.send = function (
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ) {
      if (typeof data === "string") {
        if (!data.includes("clientUpdatePosition")) {
          log("WS", "SEND: " + data.substring(0, 120));
        }

        // Track position
        if (data.includes("clientUpdatePosition")) {
          try {
            const jsonStr = data.substring(data.indexOf("["));
            const parsed = JSON.parse(jsonStr);
            if (parsed[0] === "clientUpdatePosition" && parsed[1]) {
              window.__playerPos = parsed[1];
            }
          } catch (_e) {
            // ignore parse errors
          }
        }

      }
      return _origSend(data);
    };
    log("WS", "send() hooked");
  }

  ws.addEventListener("open", () => {
    log("WS", "OPEN, url: " + url);
  });

  ws.addEventListener("close", (e) => {
    log("WS", "CLOSE, code: " + e.code + " reason: " + e.reason);
  });

  ws.addEventListener("error", (e) => {
    log("WS", "ERROR", e);
  });

  ws.addEventListener("message", (e) => {
    try {
      const data = typeof e.data === "string" ? e.data : "";

      // Skip empty messages
      if (data.length === 0) return;

      // Always skip high-frequency position events from other players
      if (data.includes("playerMoved") || data.includes("updatePosition")) {
        logWsAll("RECV [position]: " + data.substring(0, 200));
        return;
      }

      // Parse Socket.IO event messages (format: 42["eventName", data])
      if (data.startsWith("42")) {
        try {
          const jsonStr = data.substring(data.indexOf("["));
          const parsed = JSON.parse(jsonStr);
          const eventName = parsed[0];
          const eventData = parsed[1];

          // Events that are always ours (responses to our own actions)
          const localEvents = [
            "connected",
            "fishingFrenzyUpdate",
            "focus-stats-updated",
          ];

          // Events that are always about other players or broadcast noise
          const otherPlayerEvents = [
            "playerMoved",
            "updatePosition",
            "playerDisconnected",
            "playerConnected",
            "initOtherPlayers",
            "playerJoinedRoom",
            "playerLeftRoom",
            "newFocusSessionData",
            "updateAvatarTraitsResponse",
          ];

          if (otherPlayerEvents.includes(eventName)) {
            extractPlayerProfiles(eventName, eventData);
            logWsAll("RECV [other:" + eventName + "]: " + data.substring(0, 200));
            return;
          }

          // For non-local events, check all parsed args for a foreign player ID
          if (!localEvents.includes(eventName) && window.__localPlayerId) {
            const myId = window.__localPlayerId;
            let foundForeignId = false;

            for (let i = 1; i < parsed.length; i++) {
              const arg = parsed[i];
              // ID as direct string argument — Discord-style numeric or UUID
              if (typeof arg === "string" && arg !== myId) {
                if (
                  /^\d{15,}$/.test(arg) ||
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    arg,
                  )
                ) {
                  foundForeignId = true;
                  break;
                }
              }
              // ID inside an object (e.g. 42["event", {id: "playerId", ...}])
              if (arg && typeof arg === "object") {
                const objId = arg.id || arg.playerId || arg.userId;
                if (objId && String(objId) !== myId) {
                  foundForeignId = true;
                  break;
                }
              }
            }

            if (foundForeignId) {
              logWsAll("RECV [foreign:" + eventName + "]: " + data.substring(0, 200));
              return;
            }
          }

          // Log the event
          log("WS", "RECV: " + data.substring(0, 200));

          // Handle fishing events (only for local player)
          if (eventName === "fishCaught" && eventData) {
            const lp = window.__gameApp?.localPlayer;
            if (lp && lp.currentSeatId) {
              log("WS", ">>> FISH CAUGHT EVENT <<<");
              window.__fishBite = eventData;
              log("WS", "Fish bite data: " + JSON.stringify(eventData).substring(0, 200));
            } else {
              logWsAll("RECV [other:fishCaught]: " + data.substring(0, 200));
              return;
            }
          }

          if (eventName === "fishing-result" && eventData) {
            const myId = window.__localPlayerId;
            if (myId && eventData.userId && String(eventData.userId) !== myId) {
              logWsAll("RECV [other:fishing-result]: " + data.substring(0, 200));
              return;
            }
            log("WS", ">>> FISHING RESULT EVENT <<<");
            window.__lastFish = eventData;
            log("WS", "Fish result: " + JSON.stringify(eventData).substring(0, 200));
          }
        } catch (_e) {
          // Not parseable as event, log if short enough
          if (data.length < 500) {
            log("WS", "RECV: " + data.substring(0, 200));
          }
        }
        return;
      }

      // Non-event messages (handshake, ping/pong, etc.) - log if short
      if (data.length < 500) {
        log("WS", "RECV: " + data.substring(0, 200));
      }
    } catch (err) {
      log("WS", "message parse error: " + (err as Error).message);
    }
  });

  return ws;
};

(window as any).WebSocket.prototype = OrigWS.prototype;
Object.defineProperty(window.WebSocket, "CONNECTING", { value: 0 });
Object.defineProperty(window.WebSocket, "OPEN", { value: 1 });
Object.defineProperty(window.WebSocket, "CLOSING", { value: 2 });
Object.defineProperty(window.WebSocket, "CLOSED", { value: 3 });
log("WS", "WebSocket constructor hooked");

export {};
