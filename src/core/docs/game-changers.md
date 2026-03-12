# Game-Changers : ce que les analyses revelent par rapport au mod actuel

> Genere le 2026-03-12 par croisement des analyses de chunks webpack (gameFiles-analysis/) avec le code existant du mod.
> Ce document liste uniquement les decouvertes NOUVELLES ou les ameliorations significatives par rapport a ce qui est deja implemente.

## 1. Zustand Stores — acces direct a TOUT l'etat du jeu

**Impact : CRITIQUE. C'est le plus gros upgrade possible du mod.**

Le mod capture actuellement `gameApp` (module 20493) via webpack spy, mais ne capture AUCUN store Zustand. Or les stores contiennent tout l'etat cote client :

| Store | Module ID | Donnees cles |
|-------|-----------|-------------|
| `useUserData` | 92764 | `uid`, `accessToken` (JWT), `points`, `permissionLevel`, `friendsList`, `fishInventory`, `ownedTraits`, `ownedFurniture`, `burrows`, `isDonator` |
| `useSettings` | 29546 | `settings` (theme, volumes, keybinds, streamerMode), `zoom`, `timeDifference` (offset serveur), `channel` (chat) |
| `useUsersStore` | 62021 | `users` — TOUS les joueurs connectes au lobby avec profil, status, room, focus session |
| `useLobbyStore` | 65749 | `lobbies` — liste de TOUS les serveurs avec player counts, `currentLobby` |
| `useMissionStore` | 79165 | `dailyMissions`, `weeklyMissions`, `progressMission(key, amount)` |
| `useFocusSession` | 59740 | Etat complet de la session focus/pomodoro, lobby code, player IDs |
| `useFishingStats` | 20079 | Stats de peche (total, gold, legendaries, shinies, unique, heaviest) |
| `useModalStore` | 9192 | Controle des modals UI — `changeModal("Info")`, `setInspectedPlayerId()` |
| `useFishingFrenzy` | 79709 | Etat du fishing frenzy event communautaire |
| `useFriendPresence` | 8626 | `presences` — Record<userId, lobbyName> de tous les amis |
| `useSceneEditor` | 88 (chunk 493) | Editeur de burrow — `tool`, `selectedFurniture`, `infiniteMode` |

**Ce que ca debloque :**
- `useUserData.getState().accessToken` → JWT pour faire des appels API directement
- `useUserData.getState().points` → lire/afficher les points en temps reel
- `useUsersStore.getState().users` → remplacerait le tracking manuel de `__playerProfiles` + `__friendIds`
- `useLobbyStore.getState().lobbies` → liste dynamique des lobbies au lieu de les hardcoder
- `useMissionStore.getState().progressMission("emote", 5)` → auto-progression missions

**Implementation :** Etendre `webpack-spy.ts` pour capturer les stores via `require()` sur leurs module IDs.

## 2. GameGlobals / Signal Bus (module 20993)

**Impact : ELEVE. Controle programmatique de l'UI et du jeu.**

Le singleton `GameGlobals` (export `A` du module 20993) contient un EventEmitter (`signal`) qui est le bus d'events interne du jeu. Le mod ne le capture pas.

**Proprietes directes :**
- `manualCameraControl: boolean` → active le mode camera libre
- `dragCameraMode: boolean` → camera deplacable au drag
- `progressMission(key, amount)` → raccourci direct vers la progression de missions
- `isHidden: () => boolean` → callback qui dit si le jeu est masque

**Signals emettables (non exhaustif) :**
```
confetti                         — declenche l'animation confetti
portable-chair                   — poser une chaise portable
sit-animation, "laptop"|"book"   — changer l'animation assise
visitBurrow, {burrowId, template, ownerId}  — visiter un burrow
showFishingInventory, "default"  — ouvrir l'inventaire poisson
showFishingJournal               — ouvrir le journal de peche
dm, "username"                   — ouvrir un DM avec un joueur
channelChange, "global"|"local"  — switch le canal de chat
show-focus-modal                 — ouvrir la modal focus
startAcceptingInput, "panel"     — reactiver l'input clavier
stopAcceptingInput, "panel"      — bloquer l'input clavier
```

**Ce que ca debloque :**
- Free camera pour explorer la map sans bouger le joueur
- Declenchement d'actions UI sans simuler des clicks DOM
- Auto-visite de burrows via signal au lieu de `loadScene` direct

## 3. Client HTTP authentifie (module 15764)

**Impact : ELEVE. Appels API directs sans reconstruire les headers.**

Le wrapper `E` du module 15764 est un fetch avec Bearer token automatique. Le mod n'y a pas acces actuellement — les appels API sont faits manuellement.

**Endpoints decouverts non exploites par le mod :**

| Methode | Endpoint | Usage |
|---------|----------|-------|
| POST | `/api/sellFish` | `{fishIds: string[]}` → `{goldToGain}` — vente batch |
| POST | `/api/sendToAquarium` | `{fishId}` — envoyer un poisson |
| POST | `/api/sendToInventory` | `{fishId}` — retirer de l'aquarium |
| POST | `/api/createBurrow` | `{templateId}` — creer un burrow |
| POST | `/api/setBurrowPrivacyLevel` | `{burrowId, privacyLevel}` — changer la privacy |
| POST | `/api/progressMission` | `{progressKey, amount}` — progression manuelle |
| GET | `/api/profilePage?userId=X` | Charger le profil d'un joueur |
| GET | `/api/fishing/stats/{userId}` | Stats de peche d'un joueur |
| GET | `/api/getCurrentMissionsAndProgress` | Missions + progression |

**Ce que ca debloque :**
- Vente automatique de poissons dans le bot fishing
- Gestion de burrows programmatique
- Lecture de stats d'autres joueurs

## 4. Orchestrator API (module 9667)

**Impact : MOYEN. Remplace les lobbies hardcodes.**

URL : `https://orchestrator.lofi.town` (ou `/.proxy/orchestrator` en mode Discord).

| Methode | Endpoint | Retour |
|---------|----------|--------|
| GET | `/servers` | `{servers: Server[], recommended: Server}` — tous les serveurs avec noms + player counts |
| GET | `/player-counts` | Nombre de joueurs par serveur |

**Ce que ca debloque :**
- Liste dynamique des lobbies avec population
- Choix automatique du lobby le moins peuple
- Detection de nouveaux lobbies sans modifier le code

## 5. Socket.IO client wrapper (module 51496)

**Impact : MOYEN. API plus propre que le raw WS hook.**

Le mod intercepte le WebSocket natif, mais le client Socket.IO wrapper (export `A` du module 51496) offre :
- `.socket` — instance Socket.IO directe
- `.emit(event, data)` / `.on(event, callback)`
- `.awaitEvent(event)` — listener Promise-based (utile pour les flows sequentiels)

Pas un remplacement du WS hook (qui doit rester pour l'interception), mais un complement pour emettre/ecouter des events plus proprement.

## 6. Parametres du minigame de peche (non documentes)

**Impact : MOYEN. Donnees utiles pour le bot et l'affichage HUD.**

Le mod joue deja le minigame, mais ne connait pas les parametres exacts par rarete.

**Gain par press reussie :**
| Rarete | Min | Max |
|--------|-----|-----|
| Common | 15 | 25 |
| Uncommon | 12 | 22 |
| Rare | 10 | 20 |
| Epic | 8 | 18 |
| Legendary | 6 | 15 |
| Secret | 2 | 10 |

**Timer (secondes) :**
| Rarete | Temps |
|--------|-------|
| Common | 15 |
| Uncommon | 15 |
| Rare | 16 |
| Epic | 22 |
| Legendary | 30 |
| Secret | 40 |
| FTUE (tuto) | 300 |

**Angle du triangle (difficulte) :**
| Rarete | Min deg | Max deg |
|--------|---------|---------|
| Common | 50 | 179 |
| Uncommon | 45 | 150 |
| Rare | 40 | 120 |
| Epic | 40 | 90 |
| Legendary | 30 | 70 |
| Secret | 30 | 50 |

**Streak bonus :** +2 par press consecutive (a partir de 2), cap a +16.
**Penalite sur echec :** perd le dernier gain (`lastLevelGained`), streak reset.

## 7. Focus Session — farming de coins

**Impact : MOYEN. 6 coins/min passif, cap 3000/jour.**

Le systeme de focus (pomodoro) rapporte des coins automatiquement :
- `COINS_PER_MINUTE = 6`
- `DAILY_CAP = 3000`
- `PARTY_BONUS_PER_MEMBER = 1` (max total 10 coins/min avec party)

**Flow WS pour automation :**
```
emit "createFocusSession", settings → await "focusSessionCreated"
emit "startFocusSession", {} → await "focusSessionStarted"
// ... attendre la duree ...
emit "leaveFocusSession", {} → await "leftFocusSession"
```

**Ce que ca debloque :** Bot de farming de coins passif en parallele du fishing.

## 8. Mission system — auto-completion

**Impact : MOYEN. Points bonus quotidiens.**

Missions daily/weekly avec rewards :
```
complete-2-pomodoros         → 550 pts
play-45-minutes              → 500 pts
emote-5-times                → 450 pts
visit-friends-burrow         → 450 pts
catch-10-fish                → 550 pts
sell-fish-for-200-coins      → 500 pts
complete-3-tasks             → 500 pts
complete-15-pomodoros (weekly) → 1550 pts
catch-legendary-fish (weekly) → 1500 pts
```

**Ce que ca debloque :**
- Avec le signal bus : `progressMission("emote", 5)` complete instantanement "emote 5 times"
- Le bot fishing progresse deja `catch-10-fish` et `sell-fish-for-200-coins` naturellement
- Les pomodoros se progressent via le focus session farming

## 9. Debug / gizmo mode (module 9502)

**Impact : FAIBLE mais utile pour le dev.**

Le flag `cm` (module 9502) active les gizmos visuels : colliders, raycast, zones d'interaction. Utile pour debugger le noclip et les TP.

## 10. Constantes serveur

- `SOFT_CAP = 250` joueurs par lobby (apres quoi le lobby est "plein" dans la selection)
- `MAX_PLAYERS = 350` (hard limit)
- `MAX_CHAT_MSG = 500` caracteres (note : 150 chars observe en pratique dans l'UI)
- `TICK_INTERVAL = 0.05` (50ms) — rate de sync position
- Vitesse marche : `1.5`, vitesse go-kart : `3.75`

## 11. Events WS non captures par le mod

Events presents dans les analyses mais pas geres par `websocket-hook.ts` :

| Event | Direction | Interet |
|-------|-----------|---------|
| `cannotSit` | S→C | Siege deja pris — utile pour le force-fishing fallback |
| `updatePositions` | S→C | Batch update positions (alternative a playerMoved) |
| `destroyGoKart` / `createGoKart` | S→C | Go-karts sur la map |
| `focusSessionCreated/Started/Updated` | S→C | Reponses focus session |
| `focusSessionRewards` | S→C | Rewards en coins apres une session |
| `new-focus-coins` | S→C | Points recus |
| `streamerChannelUpdated` | S→C | Changement de chaine streamer |
| `refreshOwnedTraitsComplete` | S→C | Confirmation refresh traits |

## 12. Chat commands (admin/mod)

Decouvertes dans le code client (module 96221). Permission check cote client ET serveur.

| Commande | Permission | Description |
|----------|-----------|-------------|
| `/setfishchance <0-1>` | admin | Modifier la chance de peche globale |
| `/setperms <user> <level>` | admin | Changer les permissions d'un joueur |
| `/serverrestarttimer [min]` | admin | Broadcast timer de redemarrage |
| `/setstreamer <channel\|none>` | admin | Mode streamer |
| `/kick <user> <reason>` | mod | Kick un joueur |
| `/ban <user>` / `/unban` | mod | Ban/unban |
| `/mute <user> <min> <reason>` | mod | Mute temporaire |
| `/kickall <reason>` | mod | Kick tout le monde |

Pas exploitable sans permission elevee, mais bon a savoir pour comprendre le protocole.

---

## Priorite d'implementation suggeree

1. **Capture des stores Zustand** (webpack-spy.ts) — debloque tout le reste
2. **Capture du signal bus** (GameGlobals) — free camera + actions programmatiques
3. **Auto-sell dans le bot fishing** (via API sellFish)
4. **Orchestrator API** (lobbies dynamiques)
5. **Focus session farming** (coins passifs)
6. **Mission auto-progression** (via signal bus ou API)
