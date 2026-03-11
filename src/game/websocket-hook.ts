// Side-effect module: replaces window.WebSocket to intercept all connections

import { log, logWsAll } from "../utils/logger";

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

        // Block fail messages
        if (
          window.__blockFishingFail &&
          data.includes("getFishingResult") &&
          data.includes('"fail"')
        ) {
          log("WS", "BLOCKED fail message!");
          return;
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
            "fishCaught",
            "fishing-result",
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

          // Handle specific events
          if (eventName === "fishCaught" && eventData) {
            log("WS", ">>> FISH CAUGHT EVENT <<<");
            window.__fishBite = eventData;
            log("WS", "Fish bite data: " + JSON.stringify(eventData).substring(0, 200));
          }

          if (eventName === "fishing-result" && eventData) {
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
