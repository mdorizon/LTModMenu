const LOG_STORAGE_KEY = "ltmod_logs";
const MAX_LOGS = 5000;

const logs: string[] = [];

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
