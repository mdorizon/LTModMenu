# Mission System Internals (lofi.town)

> Reverse-engineered le 2026-03-13 via inspection du store Zustand et du source webpack (module 56286).
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Acces au store

```js
const store = window.__stores.useMissionStore;
const state = store.getState();
```

Le store est un Zustand store capture par webpack-spy et expose sur `window.__stores.useMissionStore`.

## Structure du state

```
dailyMissions: MissionSetRaw       — missions daily actives
weeklyMissions: MissionSetRaw      — missions weekly actives
dailyMissionProgress: Record<string, number>   — progression indexee par mission key
weeklyMissionProgress: Record<string, number>  — progression indexee par mission key
progressMission(key: string, amount?: number): void  — incremente la progression
```

### MissionSetRaw

```
{
  id: string,              — UUID du set
  type: "DAILY" | "WEEKLY",
  startDate: string,       — ISO date
  endDate: string,         — ISO date
  missions: string[]       — tableau de CLES (pas d'objets)
}
```

Les cles sont des strings comme `"visit-friends-burrow"`, `"catch-10-fish"`, `"play-5-hours"`.
Les metadonnees (titre, recompense, seuil, progressKey) sont des constantes statiques dans le code du jeu (module 56286), reproduites dans `data/mission-database.ts`.

## Distinction cle mission vs progressKey

C'est le piege principal. Deux systemes de cles coexistent :

- **Mission key** : identifie la mission (`"catch-10-fish"`, `"play-5-hours"`). Utilisee dans `missions[]` et comme index dans `*MissionProgress`.
- **progressKey** : identifie le TYPE d'action (`"catch-fish"`, `"play-hour"`). Passee a `progressMission()`.

Plusieurs missions peuvent partager le meme progressKey (ex: `"complete-2-pomodoros"` et `"complete-15-pomodoros"` utilisent tous les deux `"pomodoro-complete"`).

```
state.dailyMissionProgress["catch-10-fish"]  → 7     // progression lue par mission key
state.progressMission("catch-fish", 3)                // progression ecrite par progressKey
```

NE PAS confondre : lire la progression avec le progressKey retourne undefined.

## progressKeys connus (11)

```
pomodoro-complete      — complete un pomodoro
play-minute            — jouer N minutes (daily)
play-hour              — jouer N heures (weekly)
emote                  — utiliser un emote
visit-friends-burrow   — visiter le burrow d'un ami
visit-public-burrow    — visiter un burrow public en ville
catch-fish             — attraper un poisson
sell-fish-for-coins    — vendre des poissons (montant en coins)
place-furniture        — placer un meuble dans son burrow
complete-task          — completer une tache (todo/pomodoro task)
catch-legendary-fish   — attraper un poisson legendaire
```

## Vecteur d'auto-completion

```js
const state = store.getState();
const remaining = mission.requiredAmount - currentProgress;
state.progressMission(mission.progressKey, remaining);
```

`progressMission` passe par le flow normal du jeu (Zustand action → update state → sync serveur).
Pas besoin d'appeler d'API REST. Le store gere la persistence cote serveur.

Alternative non utilisee : `POST /api/progressMission` avec Bearer token. Plus risque (log serveur explicite), meme resultat.

## Confetti

```js
window.__gameGlobals.signal.emit("confetti");
```

Signal bus du jeu. Declenche l'animation confetti native. Appele uniquement quand `completeSingle()` retourne true (mission effectivement completee, pas deja finie).

## Mission panel natif du jeu

Deux elements DOM :
- `#missions-button` — bouton collapsed (toujours visible)
- `#mission-log` — modal depliee (visible quand ouverte)

Caches via injection CSS `display: none !important` dans un `<style>` dedie.
React recree ces elements, donc `element.remove()` ne fonctionne pas durablement. Le CSS override est la bonne approche.

Toggle persiste dans localStorage via `saveData("missionHidePanel", hidden)`, restaure au demarrage HUD via `restoreMissionPanelHide()`.

## Refresh de la vue

Pas de `store.subscribe()` — cause des boucles infinies (subscribe → render → subscribe → ...).
A la place, `setTimeout(1500)` apres chaque action (force, complete all) pour laisser le store se mettre a jour avant de re-render.

Le timeout ne se declenche que sur action utilisateur (click), pas en boucle. Il verifie que l'element `#lt-mission-status` existe encore dans le DOM avant de re-render (guard contre les changements de page).

## Pieges connus

- `dailyMissions` est un OBJET `{id, type, startDate, endDate, missions}`, PAS un tableau. Acceder a `.missions` pour avoir les cles.
- `missions` contient des STRING keys, PAS des objets avec title/requiredAmount. Resolution via `MISSION_DB` statique.
- La progression est indexee par mission key dans le state (`dailyMissionProgress["catch-10-fish"]`), PAS par progressKey.
- `progressMission()` prend le progressKey en argument, PAS la mission key.
- `store.subscribe()` + render = boucle infinie. Ne pas l'utiliser.
- Les missions changent chaque jour/semaine (rotation serveur). Les cles inconnues sont gerees avec un fallback dans `resolveMission()`.
