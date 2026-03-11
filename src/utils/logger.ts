const MAX_LOGS = 5000;
const LOG_SERVER = "http://localhost:8642/logs";
const FLUSH_INTERVAL = 2000; // flush every 2s

const logs: string[] = [];
const pending: string[] = [];

function timestamp(): string {
  return new Date().toISOString();
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

// Batch-send logs to the local dev server
function flushLogs(): void {
  if (pending.length === 0) return;
  const batch = pending.splice(0);
  fetch(LOG_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => {
    // Server not running, silently ignore
  });
}

if (__DEV__) {
  setInterval(flushLogs, FLUSH_INTERVAL);
  // Flush on page unload
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
