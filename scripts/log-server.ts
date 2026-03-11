import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const PORT = 8642;
const LOG_DIR = join(import.meta.dir, "..", "logs");
const LOG_FILE = join(LOG_DIR, "ltmodmenu.log");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB max, then rotate

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
}

async function rotateIfNeeded() {
  if (!existsSync(LOG_FILE)) return;
  const stat = Bun.file(LOG_FILE);
  if ((await stat.size) > MAX_SIZE) {
    const rotated = LOG_FILE.replace(".log", `.${Date.now()}.log`);
    await Bun.write(rotated, Bun.file(LOG_FILE));
    await Bun.write(LOG_FILE, "");
    console.log(`[log-server] Rotated logs to ${rotated}`);
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

    if (req.method === "POST" && new URL(req.url).pathname === "/logs") {
      try {
        const body = await req.json();
        const entries: string[] = Array.isArray(body) ? body : [body];
        const text = entries.join("\n") + "\n";
        await appendFile(LOG_FILE, text);
        await rotateIfNeeded();
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
console.log(`[log-server] Logs written to ${LOG_FILE}`);
