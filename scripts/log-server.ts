import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const PORT = 8642;
const LOG_DIR = join(import.meta.dir, "..", "logs");
const LOG_FILE = join(LOG_DIR, "ltmodmenu.log");
const WS_ALL_FILE = join(LOG_DIR, "ws-all.log");
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

await ensureLogDir();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const pathname = new URL(req.url).pathname;

    if (req.method === "POST" && (pathname === "/logs" || pathname === "/ws-all")) {
      try {
        const targetFile = pathname === "/ws-all" ? WS_ALL_FILE : LOG_FILE;
        const body = await req.json();
        const entries: string[] = Array.isArray(body) ? body : [body];
        const text = entries.join("\n") + "\n";
        const existing = existsSync(targetFile) ? await readFile(targetFile, "utf-8") : "";
        await writeFile(targetFile, text + existing);
        await rotateIfNeeded(targetFile);
        return new Response("ok", {
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      } catch (e: any) {
        return new Response(e.message, {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`[log-server] Listening on http://localhost:${PORT}`);
console.log(`[log-server] Main logs: ${LOG_FILE}`);
console.log(`[log-server] WS all logs: ${WS_ALL_FILE}`);
