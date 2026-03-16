#!/usr/bin/env bun
/**
 * Fetches app.lofi.town, extracts chunk info and module IDs,
 * compares with the stored manifest, and outputs a diff.
 *
 * Usage:
 *   bun run scripts/check-game-update.ts               # check only, exit 0 if no change
 *   bun run scripts/check-game-update.ts --save         # save new manifest if changed
 *   bun run scripts/check-game-update.ts --analyze      # force Claude analysis even for cosmetic
 *
 * Environment:
 *   ANTHROPIC_API_KEY   — enables Claude analysis for non-cosmetic changes
 *   GITHUB_OUTPUT       — writes structured outputs for GitHub Actions
 *
 * Exit codes:
 *   0 = no change (or --save succeeded, or running in CI)
 *   1 = changes detected (local CLI only)
 *   2 = fetch/parse error
 */

const GAME_URL = "https://app.lofi.town";
const MANIFEST_PATH = "gameFiles/manifest.json";
const SAVE = process.argv.includes("--save");
const ANALYZE = process.argv.includes("--analyze");

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

type Severity = "cosmetic" | "minor" | "breaking";

interface Analysis {
  severity: Severity;
  risk_assessment: string;
  changes_summary: string[];
  action_required: boolean;
  action_items: string[];
}

// ── Fetch & parse ──

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "LTModMenu-GameUpdateChecker/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

function extractChunkUrls(html: string): {
  scripts: string[];
  css: string[];
  buildId: string;
} {
  const scripts: string[] = [];
  const css: string[] = [];

  // Extract script src from <script src="/_next/static/chunks/..."> tags
  for (const m of html.matchAll(
    /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g,
  )) {
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

    if (
      oldChunk.filename !== currChunk.filename ||
      oldChunk.size !== currChunk.size
    ) {
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
  if (result.buildIdChanged)
    result.summary.push(`Build ID: ${old.buildId} → ${curr.buildId}`);
  if (result.addedChunks.length)
    result.summary.push(`Added chunks: ${result.addedChunks.join(", ")}`);
  if (result.removedChunks.length)
    result.summary.push(`Removed chunks: ${result.removedChunks.join(", ")}`);
  for (const id of result.modifiedChunks) {
    const oldC = old.chunks[id];
    const currC = curr.chunks[id];
    let detail = `Chunk ${id}: ${oldC.filename.split("/").pop()} → ${currC.filename.split("/").pop()} (${oldC.size}B → ${currC.size}B)`;
    if (result.addedModules[id]?.length)
      detail += `\n  + modules: ${result.addedModules[id].join(", ")}`;
    if (result.removedModules[id]?.length)
      detail += `\n  - modules: ${result.removedModules[id].join(", ")}`;
    result.summary.push(detail);
  }
  if (result.cssChanged)
    result.summary.push(`CSS changed: ${oldCss} → ${currCss}`);

  return result;
}

// ── Severity classification ──

function classifySeverity(
  diff: DiffResult,
  oldManifest: Manifest,
  newManifest: Manifest,
): Severity {
  if (diff.addedChunks.length > 0 || diff.removedChunks.length > 0)
    return "breaking";

  const hasAdded = Object.keys(diff.addedModules).length > 0;
  const hasRemoved = Object.keys(diff.removedModules).length > 0;

  if (hasRemoved) return "minor";
  if (hasAdded) return "minor";

  // Significant size change without module additions/removals = potential
  // internal code modification (property renames, new logic, etc.)
  for (const id of diff.modifiedChunks) {
    const oldSize = oldManifest.chunks[id]?.size ?? 0;
    const newSize = newManifest.chunks[id]?.size ?? 0;
    if (Math.abs(newSize - oldSize) > 1000) return "minor";
  }

  // Only hash changes, tiny size deltas, or CSS changes = cosmetic rebuild
  return "cosmetic";
}

// ── Claude API analysis ──

const ANALYSIS_PROMPT = `Analyze this webpack build diff for a Tampermonkey mod targeting lofi.town.

The mod detects modules by runtime signatures (not webpack IDs). Signatures:
STORES (Zustand getState() keys): useUserData(accessToken+fishInventory), useSettings(settings.playlistVolume+timeDifference), useUsersStore(users+userCount), useLobbyStore(lobbies[]+currentLobby), useMissionStore(dailyMissions+weeklyMissions), useFocusSession(focusInProgress+sessionSettings), useFishingStats(totalFishCaught+totalGoldEarned), useModalStore(modal+inspectedPlayerId), useFishingFrenzy(communityGoalPoppedOut+status), useFriendPresence(presences+setPresence)
OTHER: App(prototype.loadScene+_instance), GameGlobals(signal.emit+manualCameraControl+dragCameraMode), SocketClient(_socket+listeners+sessionId), playSound(sfxVolume+.rate()+.play())
Chunks: 2380=engine/scenes, 5677=stores/data, page=React UI, webpack=loader

DIFF:
`;

async function analyzeWithClaude(diff: DiffResult): Promise<Analysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("No ANTHROPIC_API_KEY — skipping AI analysis.");
    return null;
  }

  console.log("Running Claude analysis...");
  const prompt =
    ANALYSIS_PROMPT +
    diff.summary.join("\n") +
    `\n\nRespond ONLY with JSON, no markdown fences:\n{"severity":"cosmetic|minor|breaking","risk_assessment":"one sentence in french","changes_summary":["short bullet in french","..."],"action_required":false,"action_items":["if any, in french"]}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`Claude API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as any;
    const text: string | undefined = data.content?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as Analysis;
  } catch (e: any) {
    console.warn(`Claude analysis failed: ${e.message}`);
    return null;
  }
}

// ── Discord payload ──

function buildDiscordPayload(
  severity: Severity,
  diff: DiffResult,
  analysis: Analysis | null,
): { title: string; description: string; color: number } | null {
  // Only notify when action is needed, or when we can't tell (no analysis + not cosmetic)
  const shouldNotify = analysis
    ? analysis.action_required
    : severity !== "cosmetic";
  if (!shouldNotify) return null;

  const changes = analysis?.changes_summary?.length
    ? analysis.changes_summary.map((c) => `• ${c}`).join("\n")
    : diff.summary.join("\n");

  const actions = analysis?.action_items?.length
    ? analysis.action_items.map((i) => `• ${i}`).join("\n")
    : "• Analyse manuelle requise";

  const verdict =
    analysis?.risk_assessment ??
    "Analyse IA indisponible — vérification manuelle recommandée.";

  return {
    title: "⚠️ Mise à jour lofi.town — Le mod a besoin d'attention",
    description: [
      "Le jeu a été mis à jour et le mod pourrait avoir besoin d'ajustements.",
      "",
      "**Ce qui a changé :**",
      changes,
      "",
      "**Ce qu'il faut faire :**",
      actions,
      "",
      `**Verdict :** ${verdict}`,
      "",
      "Les devs sont dessus, pas de panique !",
    ].join("\n"),
    color: severity === "breaking" ? 15548997 : 16750848, // red or orange
  };
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
  console.log(
    `Found ${scripts.length} chunks, ${css.length} CSS files, build ${buildId}`,
  );

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
    existing.lastChecked = current.lastChecked;
    if (SAVE) await Bun.write(MANIFEST_PATH, JSON.stringify(existing, null, 2));
    return;
  }

  console.log("\n=== GAME UPDATE DETECTED ===\n");
  for (const line of diff.summary) {
    console.log(line);
  }

  // Classify severity
  const baseSeverity = classifySeverity(diff, existing, current);
  console.log(`\nSeverity: ${baseSeverity}`);

  // Claude analysis (when not cosmetic, or forced with --analyze)
  let analysis: Analysis | null = null;
  if (baseSeverity !== "cosmetic" || ANALYZE) {
    analysis = await analyzeWithClaude(diff);
    if (analysis) {
      console.log(`Claude verdict: ${analysis.risk_assessment}`);
      if (analysis.action_required && analysis.action_items.length) {
        console.log("Actions requises:");
        for (const item of analysis.action_items) console.log(`  - ${item}`);
      }
    }
  }

  const finalSeverity = analysis?.severity ?? baseSeverity;
  const shouldCreateIssue =
    analysis?.action_required ?? finalSeverity === "breaking";
  const discord = buildDiscordPayload(finalSeverity, diff, analysis);

  // CI outputs
  if (process.env.GITHUB_OUTPUT) {
    const lines: string[] = [
      `changed=true`,
      `severity=${finalSeverity}`,
      `create_issue=${shouldCreateIssue}`,
      `summary<<EOFS`,
      ...diff.summary,
      `EOFS`,
    ];
    if (discord) {
      lines.push(
        `discord_title=${discord.title}`,
        `discord_color=${discord.color}`,
        `discord_description<<EOFD`,
        discord.description,
        `EOFD`,
      );
    }
    if (analysis?.risk_assessment) {
      lines.push(`risk_assessment=${analysis.risk_assessment}`);
    }
    await Bun.write(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  }

  if (SAVE) {
    current.lastChanged = new Date().toISOString();
    await Bun.write(MANIFEST_PATH, JSON.stringify(current, null, 2));
    console.log("\nManifest updated.");
  }

  // Exit 1 to signal "changes detected" (local use only, not in CI)
  if (!SAVE && !process.env.GITHUB_OUTPUT) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
