import { isWsAllEnabled, setWsAllEnabled } from "../../utils/logger";

export function renderDevTools(container: HTMLElement): void {
  if (!__DEV__) return;

  const enabled = isWsAllEnabled();

  // Remove existing dev section if re-rendering
  const existing = document.getElementById("lt-dev-tools");
  if (existing) existing.remove();

  const section = document.createElement("div");
  section.id = "lt-dev-tools";
  section.innerHTML =
    '<div class="lt-sep"></div>' +
    '<div class="lt-dev-label">DEV</div>' +
    '<button class="lt-action ' +
    (enabled ? "lt-danger" : "lt-muted") +
    '" id="lt-ws-all-toggle">' +
    "WS All Logs: " +
    (enabled ? "ON" : "OFF") +
    "</button>";

  container.appendChild(section);

  document.getElementById("lt-ws-all-toggle")!.onclick = () => {
    setWsAllEnabled(!isWsAllEnabled());
    renderDevTools(container);
  };
}
