// Side-effect module: replaces window.WebSocket to intercept all connections

console.log("[LTModMenu] Setting up WebSocket hook...");
const OrigWS = window.WebSocket;
console.log("[LTModMenu] Original WebSocket:", typeof OrigWS);

(window as any).WebSocket = function (...args: any[]) {
  const url = args[0] || "";
  console.log("[LTModMenu] new WebSocket() called, url:", url);

  const ws = new (Function.prototype.bind.apply(OrigWS, [
    null,
    ...args,
  ]) as any)() as WebSocket;
  console.log("[LTModMenu] WebSocket created, readyState:", ws.readyState);

  if (typeof url === "string") {
    window.__gameWS = ws;
    console.log("[LTModMenu] Stored as __gameWS");

    // Hook send
    const _origSend = ws.send.bind(ws);
    ws.send = function (
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ) {
      if (typeof data === "string") {
        if (!data.includes("clientUpdatePosition")) {
          console.log("[LTModMenu] WS SEND:", data.substring(0, 120));
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
          console.log("[LTModMenu] BLOCKED fail message!");
          return;
        }
      }
      return _origSend(data);
    };
    console.log("[LTModMenu] WS send() hooked");
  }

  ws.addEventListener("open", () => {
    console.log("[LTModMenu] WS OPEN, url:", url);
  });

  ws.addEventListener("close", (e) => {
    console.log("[LTModMenu] WS CLOSE, code:", e.code, "reason:", e.reason);
  });

  ws.addEventListener("error", (e) => {
    console.log("[LTModMenu] WS ERROR:", e);
  });

  ws.addEventListener("message", (e) => {
    try {
      const data = typeof e.data === "string" ? e.data : "";

      // Skip empty messages
      if (data.length === 0) return;

      // Always skip high-frequency position events from other players
      if (data.includes("playerMoved") || data.includes("updatePosition")) {
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

          if (otherPlayerEvents.includes(eventName)) return;

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

            if (foundForeignId) return;
          }

          // Log the event
          console.log("[LTModMenu] WS RECV:", data.substring(0, 200));

          // Handle specific events
          if (eventName === "fishCaught" && eventData) {
            console.log("[LTModMenu] >>> FISH CAUGHT EVENT <<<");
            window.__fishBite = eventData;
            console.log(
              "[LTModMenu] Fish bite data:",
              JSON.stringify(eventData).substring(0, 200),
            );
          }

          if (eventName === "fishing-result" && eventData) {
            console.log("[LTModMenu] >>> FISHING RESULT EVENT <<<");
            window.__lastFish = eventData;
            console.log(
              "[LTModMenu] Fish result:",
              JSON.stringify(eventData).substring(0, 200),
            );
          }
        } catch (_e) {
          // Not parseable as event, log if short enough
          if (data.length < 500) {
            console.log("[LTModMenu] WS RECV:", data.substring(0, 200));
          }
        }
        return;
      }

      // Non-event messages (handshake, ping/pong, etc.) - log if short
      if (data.length < 500) {
        console.log("[LTModMenu] WS RECV:", data.substring(0, 200));
      }
    } catch (err) {
      console.log(
        "[LTModMenu] WS message parse error:",
        (err as Error).message,
      );
    }
  });

  return ws;
};

(window as any).WebSocket.prototype = OrigWS.prototype;
Object.defineProperty(window.WebSocket, "CONNECTING", { value: 0 });
Object.defineProperty(window.WebSocket, "OPEN", { value: 1 });
Object.defineProperty(window.WebSocket, "CLOSING", { value: 2 });
Object.defineProperty(window.WebSocket, "CLOSED", { value: 3 });
console.log("[LTModMenu] WebSocket constructor hooked");

export {};
