import { isWsAllEnabled, setWsAllEnabled } from "@core/logger";
import {
  isConsoleFilterEnabled,
  setConsoleFilterEnabled,
} from "@core/console-filter";

function toggleBtn(id: string, label: string, enabled: boolean): string {
  const cls = enabled ? "lt-danger" : "lt-muted";
  return `<button class="lt-action ${cls}" id="${id}">${label}: ${enabled ? "ON" : "OFF"}</button>`;
}

export function renderDevTools(container: HTMLElement): void {
  if (!__DEV__) return;

  const existing = document.getElementById("lt-dev-tools");
  if (existing) existing.remove();

  const section = document.createElement("div");
  section.id = "lt-dev-tools";
  section.innerHTML =
    '<div class="lt-sep"></div>' +
    '<div class="lt-dev-label">DEV</div>' +
    '<div class="lt-dev-row">' +
    toggleBtn("lt-ws-all-toggle", "WS All Logs", isWsAllEnabled()) +
    toggleBtn(
      "lt-console-filter-toggle",
      "Game Console Logs",
      !isConsoleFilterEnabled(),
    ) +
    "</div>";

  container.appendChild(section);

  document.getElementById("lt-ws-all-toggle")!.onclick = () => {
    setWsAllEnabled(!isWsAllEnabled());
    renderDevTools(container);
  };

  document.getElementById("lt-console-filter-toggle")!.onclick = () => {
    setConsoleFilterEnabled(!isConsoleFilterEnabled());
    renderDevTools(container);
  };
}
