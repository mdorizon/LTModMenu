#!/usr/bin/env bun
/**
 * Fetches app.lofi.town, extracts chunk info and module IDs,
 * compares with the stored manifest, and outputs a diff.
 *
 * Usage:
 *   bun run scripts/check-game-update.ts           # check only, exit 0 if no change
 *   bun run scripts/check-game-update.ts --save     # save new manifest if changed
 *
 * Exit codes:
 *   0 = no change (or --save succeeded)
 *   1 = changes detected
 *   2 = fetch/parse error
 */

const GAME_URL = "https://app.lofi.town";
const MANIFEST_PATH = "gameFiles/manifest.json";
const SAVE = process.argv.includes("--save");

// ── Types ──

interface ChunkInfo {
  filename: string;
  size: number;
  modules: number[];
}

interface Manifest {
  lastChecked: string;
  lastChanged: string;
  buildId: string;
  chunks: Record<string, ChunkInfo>;
  css: string[];
}

interface DiffResult {
  changed: boolean;
  buildIdChanged: boolean;
  addedChunks: string[];
  removedChunks: string[];
  modifiedChunks: string[];
  addedModules: Record<string, number[]>;
  removedModules: Record<string, number[]>;
  cssChanged: boolean;
  summary: string[];
}

// ── Fetch & parse ──

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "LTModMenu-GameUpdateChecker/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

function extractChunkUrls(html: string): { scripts: string[]; css: string[]; buildId: string } {
  const scripts: string[] = [];
  const css: string[] = [];

  // Extract script src from <script src="/_next/static/chunks/..."> tags
  for (const m of html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)) {
    scripts.push(m[1]);
  }

  // Extract CSS href
  for (const m of html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)) {
    css.push(m[1]);
  }

  // Extract build ID from the inline JSON (pattern: \"b\":\"<buildId>\")
  const buildMatch = html.match(/\\"b\\":\\"([^\\]+)\\"/);
  const buildId = buildMatch ? buildMatch[1] : "unknown";

  return { scripts, css, buildId };
}

function extractModuleIds(source: string): number[] {
  // Webpack modules in minified chunks: ,XXXXX:(e,t,a)=>{ or ,XXXXX:function(
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const m of source.matchAll(/(?:^|,)(\d{4,6})(?=:\(|:function)/g)) {
    const id = parseInt(m[1], 10);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.sort((a, b) => a - b);
}

function chunkId(filename: string): string {
  // "/_next/static/chunks/5677-de530ae9a5167ba0.js" → "5677"
  // "/_next/static/chunks/app/page-d02fb4af1daa607e.js" → "page"
  // "/_next/static/chunks/87c73c54-09e1ba5c70e60a51.js" → "87c73c54"
  const base = filename.split("/").pop()!.replace(".js", "");
  const dash = base.indexOf("-");
  if (dash === -1) return base;
  const prefix = base.substring(0, dash);
  // If prefix is a number, it's a chunk ID like "5677"
  // If not, it's a hash-named chunk like "87c73c54"
  return /^\d+$/.test(prefix) ? prefix : prefix;
}

function cssId(filename: string): string {
  return filename.split("/").pop()!;
}

// ── Diff ──

function diffManifests(old: Manifest, curr: Manifest): DiffResult {
  const result: DiffResult = {
    changed: false,
    buildIdChanged: old.buildId !== curr.buildId,
    addedChunks: [],
    removedChunks: [],
    modifiedChunks: [],
    addedModules: {},
    removedModules: {},
    cssChanged: false,
    summary: [],
  };

  const oldIds = new Set(Object.keys(old.chunks));
  const currIds = new Set(Object.keys(curr.chunks));

  // Added chunks
  for (const id of currIds) {
    if (!oldIds.has(id)) {
      result.addedChunks.push(id);
      result.changed = true;
    }
  }

  // Removed chunks
  for (const id of oldIds) {
    if (!currIds.has(id)) {
      result.removedChunks.push(id);
      result.changed = true;
    }
  }

  // Modified chunks (same ID, different content)
  for (const id of currIds) {
    if (!oldIds.has(id)) continue;
    const oldChunk = old.chunks[id];
    const currChunk = curr.chunks[id];

    if (oldChunk.filename !== currChunk.filename || oldChunk.size !== currChunk.size) {
      result.modifiedChunks.push(id);
      result.changed = true;

      // Module-level diff
      const oldMods = new Set(oldChunk.modules);
      const currMods = new Set(currChunk.modules);
      const added = currChunk.modules.filter((m) => !oldMods.has(m));
      const removed = oldChunk.modules.filter((m) => !currMods.has(m));
      if (added.length) result.addedModules[id] = added;
      if (removed.length) result.removedModules[id] = removed;
    }
  }

  // CSS
  const oldCss = old.css.sort().join(",");
  const currCss = curr.css.sort().join(",");
  if (oldCss !== currCss) {
    result.cssChanged = true;
    result.changed = true;
  }

  if (result.buildIdChanged) result.changed = true;

  // Summary
  if (result.buildIdChanged) result.summary.push(`Build ID: ${old.buildId} → ${curr.buildId}`);
  if (result.addedChunks.length) result.summary.push(`Added chunks: ${result.addedChunks.join(", ")}`);
  if (result.removedChunks.length) result.summary.push(`Removed chunks: ${result.removedChunks.join(", ")}`);
  for (const id of result.modifiedChunks) {
    const oldC = old.chunks[id];
    const currC = curr.chunks[id];
    let detail = `Chunk ${id}: ${oldC.filename.split("/").pop()} → ${currC.filename.split("/").pop()} (${oldC.size}B → ${currC.size}B)`;
    if (result.addedModules[id]?.length) detail += `\n  + modules: ${result.addedModules[id].join(", ")}`;
    if (result.removedModules[id]?.length) detail += `\n  - modules: ${result.removedModules[id].join(", ")}`;
    result.summary.push(detail);
  }
  if (result.cssChanged) result.summary.push(`CSS changed: ${oldCss} → ${currCss}`);

  return result;
}

// ── Main ──

async function main(): Promise<void> {
  console.log("Fetching app.lofi.town...");
  let html: string;
  try {
    html = await fetchText(GAME_URL);
  } catch (e: any) {
    console.error("Failed to fetch game page:", e.message);
    process.exit(2);
  }

  const { scripts, css, buildId } = extractChunkUrls(html);
  console.log(`Found ${scripts.length} chunks, ${css.length} CSS files, build ${buildId}`);

  // Fetch all chunks in parallel
  const chunks: Record<string, ChunkInfo> = {};
  const fetches = scripts.map(async (url) => {
    const id = chunkId(url);
    try {
      const source = await fetchText(GAME_URL + url);
      const modules = extractModuleIds(source);
      chunks[id] = {
        filename: url,
        size: new TextEncoder().encode(source).length,
        modules,
      };
    } catch (e: any) {
      console.warn(`Failed to fetch chunk ${id}: ${e.message}`);
    }
  });
  await Promise.all(fetches);
  console.log(`Fetched ${Object.keys(chunks).length} chunks`);

  const current: Manifest = {
    lastChecked: new Date().toISOString(),
    lastChanged: new Date().toISOString(),
    buildId,
    chunks,
    css: css.map(cssId),
  };

  // Load existing manifest
  let existing: Manifest | null = null;
  try {
    const file = Bun.file(MANIFEST_PATH);
    if (await file.exists()) {
      existing = await file.json();
    }
  } catch (_) {
    // no manifest yet
  }

  if (!existing) {
    console.log("No existing manifest — creating initial one.");
    await Bun.write(MANIFEST_PATH, JSON.stringify(current, null, 2));
    console.log("Manifest saved to " + MANIFEST_PATH);
    return;
  }

  // Diff
  const diff = diffManifests(existing, current);

  if (!diff.changed) {
    console.log("No changes detected.");
    // Update lastChecked
    existing.lastChecked = current.lastChecked;
    if (SAVE) await Bun.write(MANIFEST_PATH, JSON.stringify(existing, null, 2));
    return;
  }

  console.log("\n=== GAME UPDATE DETECTED ===\n");
  for (const line of diff.summary) {
    console.log(line);
  }

  // Output as GitHub Actions output if running in CI
  if (process.env.GITHUB_OUTPUT) {
    const Bun = globalThis.Bun;
    const outputFile = process.env.GITHUB_OUTPUT;
    const body = diff.summary.join("\\n");
    await Bun.write(outputFile, `changed=true\nsummary<<EOF\n${diff.summary.join("\n")}\nEOF\n`);
  }

  if (SAVE) {
    current.lastChanged = new Date().toISOString();
    await Bun.write(MANIFEST_PATH, JSON.stringify(current, null, 2));
    console.log("\nManifest updated.");
  }

  // Exit 1 to signal "changes detected" (useful for CI)
  if (!SAVE) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
