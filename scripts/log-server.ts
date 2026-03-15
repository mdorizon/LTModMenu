import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const PORT = 8642;
const LOG_DIR = join(import.meta.dir, "..", "logs");
const LOG_FILE = join(LOG_DIR, "client.log");
const WS_ALL_FILE = join(LOG_DIR, "ws-raw.log");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB max, then rotate

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
}

async function rotateIfNeeded(filePath: string) {
  if (!existsSync(filePath)) return;
  const stat = Bun.file(filePath);
  if ((await stat.size) > MAX_SIZE) {
    const rotated = filePath.replace(".log", `.${Date.now()}.log`);
    await Bun.write(rotated, Bun.file(filePath));
    await Bun.write(filePath, "");
    console.log(`[log-server] Rotated ${filePath} to ${rotated}`);
  }
}

async function appendLogs(filePath: string, entries: string[]) {
  const text = entries.join("\n") + "\n";
  const existing = existsSync(filePath) ? await readFile(filePath, "utf-8") : "";
  await writeFile(filePath, text + existing);
  await rotateIfNeeded(filePath);
}

await ensureLogDir();

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    // Upgrade WebSocket connections
    if (server.upgrade(req)) return undefined;

    // Fallback: return 404 for non-WS requests
    return new Response("WebSocket server — connect via ws://localhost:" + PORT, {
      status: 200,
    });
  },
  websocket: {
    open(ws) {
      console.log("[log-server] Client connected");
    },
    async message(ws, message) {
      try {
        const data = JSON.parse(String(message));
        const channel: string = data.channel || "logs";
        const entries: string[] = Array.isArray(data.entries) ? data.entries : [String(data.entries)];

        const targetFile = channel === "ws-raw" ? WS_ALL_FILE : LOG_FILE;
        await appendLogs(targetFile, entries);
      } catch (e: any) {
        console.error("[log-server] Parse error:", e.message);
      }
    },
    close(ws) {
      console.log("[log-server] Client disconnected");
    },
  },
});

console.log(`[log-server] Listening on ws://localhost:${PORT}`);
console.log(`[log-server] Client logs: ${LOG_FILE}`);
console.log(`[log-server] WS raw logs: ${WS_ALL_FILE}`);
