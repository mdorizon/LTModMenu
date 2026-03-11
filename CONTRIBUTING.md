# Contributing to LTModMenu

Thanks for your interest! Here's everything you need to contribute or run the project locally.

---

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Tampermonkey](https://www.tampermonkey.net/) on your browser

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/mdorizon/LTModMenu.git
cd LTModMenu

# Install dependencies
bun install
```

### Build commands

```bash
bun run build   # Compile to dist/ltmodmenu.user.js
bun run watch   # Auto-recompile on every change
bun run clean   # Delete the dist/ folder
```

Once compiled, install `dist/ltmodmenu.user.js` in Tampermonkey and go to [lofi.town](https://lofi.town/).

> **Tip:** In `watch` mode, just reload the page after each change — Tampermonkey will automatically pick up the new version if the script is loaded from a local file.

---

## Project Structure

```
src/
├── index.ts                 # Entry point
├── types/
│   └── global.d.ts          # Global types (Window, FishStats, GameApp...)
├── data/
│   └── fish-database.ts     # 54-fish database
├── storage/
│   └── storage.ts           # localStorage helpers + auto-save
├── game/
│   ├── fish-utils.ts        # calculateGold, getRarity
│   ├── challenge-solver.ts  # FNV-1a challenge solver
│   ├── webpack-spy.ts       # Hook webpackChunk_N_E
│   ├── websocket-hook.ts    # Native WebSocket hook
│   └── player-actions.ts    # TP, sit, fish, wsSend, gameClick
├── bot/
│   └── fishing-loop.ts      # Auto fishing loop
└── ui/
    ├── styles.ts            # Menu CSS
    ├── components.ts        # mkHeader, mkItem, bindNav
    ├── hud.ts               # HUD init, drag, timer, retry
    └── pages/
        ├── main-page.ts     # Main page
        ├── poi-page.ts      # Points of interest
        ├── tp-page.ts       # Waypoints
        ├── actions-page.ts  # Player actions
        └── fish-page.ts     # Auto fishing + stats
```

---

## Useful Global Variables (console)

Handy for debugging directly in the browser console:

| Variable | Description |
| -------- | ----------- |
| `window.__gameWS` | WebSocket connection |
| `window.__gameApp` | Game App instance |
| `window.__playerPos` | Last known position |
| `window.__fishStats` | Fishing statistics |
| `window.__waypoints` | Saved waypoints |
| `window.__botPaused` | Bot pause state |
| `window.__solveFishingChallenge(c)` | Manually solve a challenge |
| `window.__forceEndMinigame()` | Force end the minigame |

---

## Publishing a Release

The project uses GitHub Actions to build and publish automatically.

```bash
git tag v2.3.0
git push origin v2.3.0
```

The workflow compiles the project and attaches `ltmodmenu.user.js` to the GitHub release assets.

---

## Opening a Pull Request

1. Fork the repo
2. Create a branch from `main`: `git checkout -b feat/my-feature`
3. Commit your changes with clear messages
4. Open a PR describing what you changed and why
