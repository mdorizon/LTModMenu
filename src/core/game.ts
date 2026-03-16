import type { PlayerPos } from "./types/player";
import { log } from "./logger";

export function wsSend(ev: string, data: unknown): boolean {
  if (window.__gameWS && window.__gameWS.readyState === 1) {
    window.__gameWS.send("42" + JSON.stringify([ev, data]));
    log("ACTION", "wsSend: " + ev);
    return true;
  }
  log("ACTION", "wsSend FAILED: " + ev + " - WS not ready");
  return false;
}

export function gameClick(x: number, y: number): void {
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    log("ACTION", "gameClick: no canvas found");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
    button: 0,
  };
  canvas.dispatchEvent(new MouseEvent("mousedown", opts));
  canvas.dispatchEvent(new MouseEvent("mouseup", opts));
  canvas.dispatchEvent(new MouseEvent("click", opts));
  log("ACTION", "gameClick at: " + x + ", " + y);
}

export function getPos(): PlayerPos | null {
  const app = window.__gameApp;
  if (app && app.localPlayer) {
    const lp = app.localPlayer;
    return {
      x: Math.round(lp.currentPos.x),
      y: Math.round(lp.currentPos.y),
      direction: lp.direction || "down",
    };
  }
  return window.__playerPos || null;
}

export function getCurrentMap(): string {
  const app = window.__gameApp;
  if (app && app.currentScene && app.currentScene.name) {
    return app.currentScene.name;
  }
  return "unknown";
}

export function getCurrentLobby(): string {
  return window.__currentLobby || "unknown";
}

const LOBBY_EMOJIS: Record<string, string> = {
  ambient: "\uD83C\uDF43",
  blossom: "\uD83C\uDF38",
  cozy: "\u2615",
  daydream: "\uD83D\uDCAD",
};

export function lobbyLabel(id: string): string {
  const emoji = LOBBY_EMOJIS[id];
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  return emoji ? emoji + " " + name : name;
}

export function switchLobby(targetLobby: string): boolean {
  if (window.__lobbySwitching) {
    log("ACTION", "switchLobby BLOCKED: switch already in progress");
    return false;
  }
  const ws = window.__gameWS;
  if (!ws || ws.readyState !== 1) {
    log("ACTION", "switchLobby FAILED: WS not ready");
    return false;
  }
  if (window.__currentLobby === targetLobby) {
    log("ACTION", "switchLobby: already on " + targetLobby);
    return true;
  }

  log("ACTION", "Switching lobby: " + (window.__currentLobby || "?") + " → " + targetLobby);
  window.__lobbySwitching = true;
  window.__lobbyOverride = targetLobby;

  // Send Socket.IO disconnect then close transport
  // Socket.IO auto-reconnect creates a new WebSocket, our hook redirects the URL
  ws.send("41");
  ws.close();

  // Safety net: auto-unlock after 10s in case the new WS never opens
  setTimeout(() => {
    if (window.__lobbySwitching) {
      window.__lobbySwitching = false;
      log("ACTION", "switchLobby lock auto-released (timeout)");
    }
  }, 10000);

  return true;
}
