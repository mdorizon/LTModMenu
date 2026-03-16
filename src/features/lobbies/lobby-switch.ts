import { switchLobby, getCurrentLobby, lobbyLabel } from "@core/game";
import { showTransitionOverlay } from "@ui/components";
import { notify } from "@ui/status-bar";
import { log } from "@core/logger";

const ORCHESTRATOR_URL = "https://orchestrator.lofi.town";
const SOFT_CAP = 250;
const SWITCH_POLL_MS = 300;
const SWITCH_TIMEOUT_MS = 10000;

async function fetchLeastPopulated(): Promise<{ id: string; count: number } | null> {
  try {
    const res = await fetch(ORCHESTRATOR_URL + "/player-counts");
    if (!res.ok) return null;
    const data: { lobbies: Record<string, number> } = await res.json();
    const current = getCurrentLobby();
    let best: { id: string; count: number } | null = null;
    for (const [id, count] of Object.entries(data.lobbies)) {
      if (id === current) continue;
      if (!best || count < best.count) best = { id, count };
    }
    return best;
  } catch {
    return null;
  }
}

export function mkLobbyButton(): string {
  return '<button class="lt-action lt-primary" id="lt-lobby-least">Join least populated lobby</button>';
}

export function bindLobbyButton(): void {
  const btn = document.getElementById("lt-lobby-least") as HTMLButtonElement | null;
  if (!btn) return;

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Fetching servers...";

    const target = await fetchLeastPopulated();
    btn.disabled = false;
    btn.textContent = "Join least populated lobby";

    if (!target) {
      notify("Failed to fetch servers", "error");
      return;
    }

    const dismissOverlay = showTransitionOverlay();
    const ok = switchLobby(target.id);
    if (ok) {
      btn.disabled = true;
      btn.textContent = "Switching to " + lobbyLabel(target.id) + "...";
      log("LOBBY", "Joining least populated: " + target.id + " (" + target.count + " players)");
      const targetId = target.id;
      const start = Date.now();
      const poll = setInterval(() => {
        if (window.__currentLobby === targetId || Date.now() - start > SWITCH_TIMEOUT_MS) {
          clearInterval(poll);
          dismissOverlay();
          btn.disabled = false;
          btn.textContent = "Join least populated lobby";
        }
      }, SWITCH_POLL_MS);
    } else {
      dismissOverlay();
      notify("Switch failed (in progress or WS down)", "error");
    }
  };
}
