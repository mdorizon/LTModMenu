# Contributing to LTModMenu

Thanks for your interest! Here's how to get started.

---

## Prerequisites

- [Bun](https://bun.sh/) (not npm)
- [Tampermonkey](https://www.tampermonkey.net/) on your browser
- A [lofi.town](https://lofi.town/) account

---

## Setup

```bash
git clone https://github.com/mdorizon/LTModMenu.git
cd LTModMenu
bun install
```

| Command | Description |
| ------- | ----------- |
| `bun run build` | Production build → `dist/ltmodmenu.user.js` |
| `bun run dev` | Watch mode + log server on port 8642 |

Then create a new script in Tampermonkey with the following content, replacing the path with your local clone:

```js
// ==UserScript==
// @name         LTModMenu - DEV
// @namespace    ltmodmenu
// @version      dev
// @match        https://app.lofi.town/*
// @require      file:///path/to/LTModMenu/dist/ltmodmenu.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
```

> **Important:** For `file:///` access to work, enable "Allow access to file URLs" in Tampermonkey's extension settings (browser extensions page → Tampermonkey → Details).

Now just reload [lofi.town](https://lofi.town/) after each build — Tampermonkey reads the file fresh every time.

---

## Project Structure

```
src/
  index.ts              # Entry point
  core/                 # Game hooks, storage, logger, module resolution
  features/             # One folder per feature (fishing, teleport, players...)
  ui/                   # HUD, styles, components, icons, theme, modals
```

Each feature folder contains its logic, UI view (`ui/*-view.ts`), and static data (`data/`).

### Import Aliases

| Alias | Path |
| ----- | ---- |
| `@core/*` | `src/core/*` |
| `@features/*` | `src/features/*` |
| `@ui/*` | `src/ui/*` |

Use aliases for cross-module imports, relative paths within the same feature.

---

## Conventions

- TypeScript strict, ES2017 target
- No hardcoded webpack module IDs (game modules are found by export signature)
- Icons go in `src/ui/icons.ts`, not inline
- Modals use `showModal()` from `src/ui/modal.ts` when possible
- Gitmoji commits: `✨` feature, `🐛` fix, `♻️` refactor, `🎨` style, `📝` docs

---

## Opening a Pull Request

1. Fork the repo
2. Branch from `main`: `git checkout -b feat/my-feature`
3. Test in-game on [lofi.town](https://lofi.town/)
4. Open a PR describing what you changed and why

Versioning and releases are handled by maintainers.
