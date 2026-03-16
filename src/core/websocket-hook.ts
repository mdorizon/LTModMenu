// Side-effect module: replaces window.WebSocket to intercept all connections

import { log, logWsAll } from "./logger";
import { loadData, saveData } from "./storage";

if (!window.__playerProfiles) {
  window.__playerProfiles = new Map();
}
if (!window.__friendIds) {
  const saved = loadData<Record<string, { online: boolean; lobby: string; displayName: string; username: string }>>("friends", {});
  const keys = Object.keys(saved);
  if (keys.length > 0) {
    window.__friendIds = new Map();
    for (const [id, data] of Object.entries(saved)) {
      window.__friendIds.set(id, { online: false, lobby: "", displayName: data.displayName || "", username: data.username || "" });
    }
    log("WS", "Restored " + keys.length + " friends from localStorage");
  } else {
    const oldIds = loadData<string[]>("friendIds", []);
    window.__friendIds = new Map();
    for (const id of oldIds) {
      window.__friendIds.set(id, { online: false, lobby: "", displayName: "", username: "" });
    }
    if (oldIds.length > 0) log("WS", "Migrated " + oldIds.length + " friends from old format");
  }
}

function persistFriends(): void {
  const obj: Record<string, { online: boolean; lobby: string; displayName: string; username: string }> = {};
  for (const [id, data] of window.__friendIds) {
    obj[id] = data;
  }
  saveData("friends", obj);
}

function emitPlayersChanged(): void {
  document.dispatchEvent(new CustomEvent("lt:players-changed"));
}

function extractFriendIds(eventName: string, eventData: any, extraData?: any): void {
  const friends = window.__friendIds;
  try {
    if (eventName === "connected" && eventData?.friendPresences) {
      const presences: Record<string, string> = eventData.friendPresences;
      const onlineIds = new Set(Object.keys(presences));
      for (const [id, lobby] of Object.entries(presences)) {
        const existing = friends.get(id);
        friends.set(id, {
          online: true,
          lobby,
          displayName: existing?.displayName || "",
          username: existing?.username || "",
        });
      }
      for (const [id, data] of friends) {
        if (!onlineIds.has(id)) {
          data.online = false;
          data.lobby = "";
        }
      }
      persistFriends();
      emitPlayersChanged();
      log("WS", "Friends from connected: " + onlineIds.size + " online, " + friends.size + " total");
    }
    if (eventName === "friendPresenceUpdate" && eventData?.userId) {
      const id = String(eventData.userId);
      const online = eventData.event === "online";
      const lobby = String(eventData.lobby || "");
      const existing = friends.get(id);
      friends.set(id, {
        online,
        lobby,
        displayName: existing?.displayName || "",
        username: existing?.username || "",
      });
      persistFriends();
      emitPlayersChanged();
    }
    if (eventName === "newFriend" && typeof eventData === "string") {
      const profile = extraData;
      const dn = profile?.displayName || profile?.username || "";
      const un = profile?.username || "";
      friends.set(eventData, { online: true, lobby: "", displayName: dn, username: un });
      persistFriends();
      emitPlayersChanged();
      log("WS", "New friend added: " + eventData + (dn ? " (" + dn + ")" : ""));
    }
  } catch (_e) {
    // ignore
  }
}

function updateFriendName(id: string, displayName: string, username: string): void {
  const friends = window.__friendIds;
  const existing = friends.get(id);
  if (!existing) return;
  if (existing.displayName === displayName && existing.username === username) return;
  existing.displayName = displayName;
  existing.username = username;
  persistFriends();
}

function extractPlayerProfiles(eventName: string, eventData: any): void {
  const profiles = window.__playerProfiles;
  try {
    if (eventName === "initOtherPlayers" && eventData?.playerStates) {
      for (const ps of eventData.playerStates) {
        if (ps.id && ps.profile) {
          const dn = ps.profile.displayName || ps.profile.username || "";
          const un = ps.profile.username || "";
          profiles.set(ps.id, {
            displayName: dn,
            username: un,
            activeBurrow: ps.profile.activeBurrow?.id ? ps.profile.activeBurrow : null,
          });
          updateFriendName(ps.id, dn, un);
        }
      }
      log("WS", "Profiles loaded: " + profiles.size + " players");
      emitPlayersChanged();
    }

    if ((eventName === "playerJoinedRoom" || eventName === "playerConnected") && eventData?.id && eventData?.profile) {
      const dn = eventData.profile.displayName || eventData.profile.username || "";
      const un = eventData.profile.username || "";
      profiles.set(eventData.id, {
        displayName: dn,
        username: un,
        activeBurrow: eventData.profile.activeBurrow?.id ? eventData.profile.activeBurrow : null,
      });
      updateFriendName(eventData.id, dn, un);
      emitPlayersChanged();
    }

    if (eventName === "playerDisconnected" || eventName === "playerLeftRoom") {
      const id = typeof eventData === "string" ? eventData : eventData?.id;
      if (id) profiles.delete(id);
      emitPlayersChanged();
    }
  } catch (_e) {
    // ignore parse errors
  }
}

log("WS", "Setting up WebSocket hook...");
const OrigWS = window.WebSocket;
log("WS", "Original WebSocket: " + typeof OrigWS);

(window as any).WebSocket = function (...args: any[]) {
  let url = args[0] || "";

  // Extract current lobby from URL and apply override if set
  let lobbySwitched = false;
  if (typeof url === "string") {
    const lobbyMatch = url.match(/wss:\/\/([^.]+)\.lofi\.town/);
    if (lobbyMatch) {
      window.__currentLobby = lobbyMatch[1];
      if (window.__lobbyOverride && window.__lobbyOverride !== lobbyMatch[1]) {
        const target = window.__lobbyOverride;
        url = url.replace(/wss:\/\/[^.]+\.lofi\.town/, "wss://" + target + ".lofi.town");
        args[0] = url;
        log("WS", "Lobby override: " + lobbyMatch[1] + " → " + target);
        window.__currentLobby = target;
        window.__lobbyOverride = null;
        lobbySwitched = true;
      }
    }
  }

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

        // Capture JWT token from Socket.IO auth (40{"token":"..."})
        // After lobby switch, strip pid/offset so the new server doesn't reject a resume attempt
        if (data.startsWith("40{")) {
          try {
            const authPayload = JSON.parse(data.substring(2));
            if (authPayload.token) {
              window.__wsAuthToken = authPayload.token;
              log("WS", "JWT token captured");
            }
            if (lobbySwitched && (authPayload.pid || authPayload.offset)) {
              delete authPayload.pid;
              delete authPayload.offset;
              data = "40" + JSON.stringify(authPayload);
              log("WS", "Stripped pid/offset for lobby switch");
            }
          } catch (_e) { /* ignore */ }
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
      if (ws.readyState !== 1) {
        log("WS", "SEND blocked: readyState=" + ws.readyState);
        return;
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

          logWsAll("RECV [" + eventName + "]: " + data);

          // Events that are always ours (responses to our own actions)
          const localEvents = [
            "connected",
            "fishingFrenzyUpdate",
            "fishing-result",
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

          extractFriendIds(eventName, eventData, parsed[2]);

          // Track player rooms (lobby-wide — we see ALL room changes in our lobby)
          if (eventName === "updateRoom" && eventData?.id && eventData.room !== undefined) {
            window.__playerRooms.set(eventData.id, eventData.room);
          }

          if (otherPlayerEvents.includes(eventName)) {
            extractPlayerProfiles(eventName, eventData);
            logWsAll("RECV [other:" + eventName + "]: " + data);
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
              logWsAll("RECV [foreign:" + eventName + "]: " + data);
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
              logWsAll("RECV [other:fishCaught]: " + data);
              return;
            }
          }

          if (eventName === "fishingFrenzyUpdate" && eventData) {
            window.__fishingFrenzyActive = !!eventData.isFrenzyActive;
            log("WS", "Fishing frenzy active: " + window.__fishingFrenzyActive);
          }

          if (eventName === "fishing-result" && eventData) {
            const myId = window.__localPlayerId;
            if (myId && eventData.userId && String(eventData.userId) !== myId) {
              logWsAll("RECV [other:fishing-result]: " + data);
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

  // After lobby switch, reset App flags so the game's "connected" handler does a full init
  // (instead of treating it as a reconnect and skipping scene/room setup)
  if (lobbySwitched) {
    ws.addEventListener("open", function onLobbyOpen() {
      ws.removeEventListener("open", onLobbyOpen);
      window.__lobbySwitching = false;
      const app = window.__gameApp;
      if (app) {
        app.isFirstLoad = true;
        app.hasInitiallyJoinedRoom = false;
        log("WS", "Lobby switch: reset App flags for full re-init");
      }

      // Sync game's React lobby store so the HUD shows the correct lobby
      const lobbyStore = window.__stores?.useLobbyStore;
      const newLobby = window.__currentLobby;
      if (lobbyStore && newLobby) {
        const state = lobbyStore.getState();
        const match = (state.lobbies as { id: string; url: string }[])
          ?.find((l: { id: string }) => l.id === newLobby);
        if (match) {
          state.setCurrentLobby(match);
          log("WS", "Lobby store synced to " + newLobby);
        }
      }
    });
  }

  return ws;
};

(window as any).WebSocket.prototype = OrigWS.prototype;
Object.defineProperty(window.WebSocket, "CONNECTING", { value: 0 });
Object.defineProperty(window.WebSocket, "OPEN", { value: 1 });
Object.defineProperty(window.WebSocket, "CLOSING", { value: 2 });
Object.defineProperty(window.WebSocket, "CLOSED", { value: 3 });
log("WS", "WebSocket constructor hooked");

export {};
