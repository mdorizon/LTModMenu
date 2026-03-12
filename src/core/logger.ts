const MAX_LOGS = 5000;
const LOG_SERVER = "http://localhost:8642/logs";
const WS_ALL_SERVER = "http://localhost:8642/ws-all";
const FLUSH_INTERVAL = 2000; // flush every 2s

const logs: string[] = [];
const pending: string[] = [];
const pendingWsAll: string[] = [];

const WS_ALL_KEY = "ltmod_wsAllLogs";
let wsAllEnabled = false;

// Restore from localStorage on load
try {
  wsAllEnabled = localStorage.getItem(WS_ALL_KEY) === "true";
} catch (_e) {
  // ignore
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`;
}

export function log(category: string, message: string, data?: unknown): void {
  const entry = data
    ? `[${timestamp()}] [${category}] ${message} ${JSON.stringify(data)}`
    : `[${timestamp()}] [${category}] ${message}`;
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }

  // In dev mode, queue for sending to log server
  if (__DEV__) {
    pending.push(entry);
  }
}

// Log all WS traffic (including filtered events) to separate file
export function logWsAll(message: string): void {
  if (!__DEV__ || !wsAllEnabled) return;
  const entry = `[${timestamp()}] ${message}`;
  pendingWsAll.push(entry);
}

export function isWsAllEnabled(): boolean {
  return wsAllEnabled;
}

export function setWsAllEnabled(enabled: boolean): void {
  wsAllEnabled = enabled;
  try {
    localStorage.setItem(WS_ALL_KEY, String(enabled));
  } catch (_e) {
    // ignore
  }
  log("WS", "All WS logging " + (enabled ? "ENABLED" : "DISABLED"));
}

// Batch-send logs to the local dev server
function flushLogs(): void {
  if (pending.length > 0) {
    const batch = pending.splice(0);
    fetch(LOG_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }

  if (pendingWsAll.length > 0) {
    const batch = pendingWsAll.splice(0);
    fetch(WS_ALL_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }
}

if (__DEV__) {
  setInterval(flushLogs, FLUSH_INTERVAL);
  window.addEventListener("beforeunload", flushLogs);
}

export function getLogs(): string[] {
  return logs;
}

export function downloadLogs(): void {
  const content = logs.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ltmodmenu-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearLogs(): void {
  logs.length = 0;
}

// Expose on window for console access
(window as any).__downloadLogs = downloadLogs;
(window as any).__clearLogs = clearLogs;
(window as any).__getLogs = getLogs;
