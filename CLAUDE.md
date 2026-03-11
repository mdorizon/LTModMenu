# CLAUDE.md - Directives du projet LTModMenu

## Ton et style

Mentor franc, direct, jamais flagorneur. Pas de formules creuses ("Super idée !", "Excellent !") sauf si sincèrement justifié. Concis par défaut, développe quand pertinent. Prose naturelle plutôt que bullet points systématiques. Pas d'emojis, pas de mise en forme excessive. Évite "honnêtement", "sincèrement", "clairement". Ton chaleureux mais pas complaisant.

## Préférences utilisateur

L'honnêteté prime sur la validation. Si une idée est mauvaise, le dire directement avec le pourquoi et proposer une alternative. Si l'utilisateur se trompe, corriger immédiatement — ne pas valider pour faire plaisir. En cas d'ambiguïté, poser des questions de clarification avant de partir dans une direction.

## Code

Pas de commentaires évidents ou redondants. Signaler les problèmes d'architecture ou de design détectés même si ce n'est pas demandé. Quand un fix est proposé, expliquer brièvement le pourquoi du bug, pas juste le quoi.

## MCP Chrome DevTools - Usage encadré

Les outils MCP Chrome DevTools (screenshots, console, click, navigate, fill, etc.) consomment beaucoup de tokens. Avant chaque appel MCP navigateur, demande confirmation à l'utilisateur via AskUserQuestion.

- Toujours demander avant d'utiliser un outil MCP Chrome DevTools
- Si l'utilisateur répond "oui, ne me demande plus", continuer librement pour la tâche en cours
- Si refus, proposer une alternative locale (Read, Grep, Bash, logs du projet)
- Logs du projet (logger centralisé) plutôt que console navigateur via MCP
- Outils locaux plutôt que MCP pour inspecter du code ou du state

---

## Projet

Userscript (Tampermonkey) mod menu pour le jeu web lofi.town. TypeScript + Webpack, output IIFE dans `dist/ltmodmenu.user.js`.

### Stack & Build

- TypeScript strict, target ES2017, bundler moduleResolution
- Webpack 5 avec ts-loader, output IIFE non-minifié
- `__DEV__` flag injecté par DefinePlugin (true en mode development)
- `npm run build` (prod), `npm run dev` (watch + log server), `npm run watch` (watch seul)
- Log server dev : `scripts/log-server.ts` (Bun HTTP sur port 8642)

### Architecture (Vertical Slices)

```
src/
├── index.ts                    # Entry point, ordre d'init critique
├── core/                       # Partagé entre toutes les features
│   ├── game.ts                 # wsSend, gameClick, getPos, getCurrentMap
│   ├── logger.ts               # log(), logWsAll(), dev server flush
│   ├── storage.ts              # localStorage wrapper, initGlobalState, autoSave
│   ├── webpack-spy.ts          # Hook webpackChunk pour capturer gameApp
│   ├── websocket-hook.ts       # Intercepte WebSocket pour logger + fishing events
│   └── types/
│       ├── global.d.ts         # Window globals, GameScene, __DEV__
│       └── player.d.ts         # PlayerPos, Waypoint, LocalPlayer, GameApp
├── features/
│   ├── fishing/                # Auto-fishing bot + force fishing
│   │   ├── data/fish-database.ts
│   │   ├── types/fish.d.ts
│   │   ├── fishing-loop.ts     # Bot state machine (5 phases)
│   │   ├── challenge-solver.ts # FNV-1a solver + setupFishingGlobals()
│   │   ├── fish-utils.ts       # calculateGold, getRarity
│   │   ├── fish-page.ts        # UI page (stats + start/stop + force fishing)
│   │   └── force-fishing.ts    # Sit + fishing animation hack
│   ├── teleport/               # TP + POI + inter-map navigation
│   │   ├── data/poi-database.ts
│   │   ├── teleport.ts         # doTP, doInterMapTP, initSceneCache
│   │   ├── poi-page.ts         # UI page POIs
│   │   └── tp-page.ts          # UI page Waypoints
│   └── actions/                # Actions joueur génériques
│       ├── sit.ts              # toggleSit state machine
│       └── actions-page.ts     # UI page Actions
└── ui/                         # Shell du menu (pas de logique métier)
    ├── hud.ts                  # Init HUD, drag, keyboard nav, retry gameApp
    ├── main-page.ts            # Page d'accueil avec liens
    ├── components.ts           # mkHeader, mkItem, mkItemTag, bindNav
    ├── styles.ts               # CSS injecté (thème via CSS vars)
    ├── theme.ts                # Sync thème avec le site lofi.town
    ├── theme-database.ts       # CSS vars mapping + couleurs par défaut
    └── dev-tools.ts            # Toggle WS All Logs (__DEV__ only)
```

### Path Aliases

Configurés dans tsconfig.json et webpack.config.js :
- `@core/*` → `src/core/*`
- `@features/*` → `src/features/*`
- `@ui/*` → `src/ui/*`

Utiliser les aliases pour tous les imports cross-module. Imports intra-feature en relatif (`./`).

### Ordre d'initialisation (index.ts)

L'ordre est critique — webpack spy et WS hook doivent être installés avant que le jeu charge :
1. Logger
2. Global state (localStorage)
3. Fish database
4. Fishing globals (challenge solver sur window)
5. Webpack chunk hook
6. WebSocket hook
7. HUD (après DOMContentLoaded)

### Conventions

- State global via `window.__*` (gameApp, gameWS, fishStats, waypoints, etc.)
- Pages HUD : chaque page est une fonction `render*(hud, renderMainFn, pages)`
- Navigation : bindNav() mappe les IDs d'éléments aux pages
- Keyboard nav : touches 1-5 (toggle, up, down, click, back)
- Le bot fishing utilise les globals window pour communiquer (fishBite, lastFish, blockFishingFail)
