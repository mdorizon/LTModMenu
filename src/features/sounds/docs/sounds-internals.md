# Sound System Internals (lofi.town)

> Reverse-engineered le 2026-03-16 via console DevTools + analyse webpack sur app.lofi.town v2.
> Ce fichier est une reference pour Claude (IA) — format optimise pour contexte LLM, pas pour lecture humaine.

## Architecture audio du jeu

Deux systemes independants :
- **Musique** : `HTMLAudioElement` unique, playlist synchronisee serveur via Zustand (`useSettings.settings.playlistVolume`)
- **SFX** : Howler.js, 48 instances `Howl` pre-chargees au demarrage dans `Howler._howls`

Les SFX ne sont jamais crees a runtime (`new Howl()` n'est pas appele apres le chargement initial). Le jeu appelle `.play()` sur les instances existantes.

## Howler._howls : structure

48 Howl instances, 39 URLs uniques :
- idx 0-1 : SFX courts (2.15s, 0.59s)
- idx 2-9 : ambient/musique (30s a 600s) — PAS des SFX
- idx 10-39 : SFX (0.17s a 2.33s)
- idx 40-47 : duplicats de idx 2-9 avec `volume: 0` (copies ambient silencieuses)
- idx 23 : duplicat d'un autre SFX (meme URL)

Chaque Howl a :
- `_src` : string ou string[] — URL utfs.io CDN
- `_duration` : duree en secondes
- `_volume` : volume (1 pour SFX, 0 pour copies ambient)

Les URLs sont opaques (`utfs.io/a/3c8oj5o1o1/...`), chargees dynamiquement (pas dans le source statique des chunks webpack).

## playSound : la fonction du jeu

```js
// Module 88390, export "U" (v2, 2026-03-16)
function c(e) {
  let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 1,
      a = h[e];       // h = sound map dans la closure {Cast: Howl, Sell: Howl, ...}
  a.rate(t),
  a.volume((0, r.i)(o.useSettings.getState().settings.sfxVolume)),
  a.play()
}
```

- `e` : nom du son (string, ex: "Cast", "Sell")
- `t` : rate/vitesse (default 1)
- `h` : map nom→Howl, **dans la closure** (pas exportee)
- Volume SFX lu depuis `useSettings.getState().settings.sfxVolume`, passe dans une courbe exponentielle (`r.i`)
- Appelee dans le jeu comme `(0,E.U)("Cast")` (pattern webpack standard)

### Detection par module-resolver

v1 : le module exportait le sound map `{Sell, Cast, Reel, ...}` ET la fonction → detection par cles du map.
v2 : seule la fonction est exportee, le map reste dans la closure → detection par source : `src.includes("sfxVolume") && src.includes(".rate(") && src.includes(".play()")`.

Ne pas hardcoder le module ID (88390). Il change a chaque build.

## SFX connus (29 noms)

Categories :
- **Fishing** : Cast, Cast-Impact, Swing, Reel, Reel-Click, Reel-Notification, Sell
- **Minigame** : Minigame-Hit, Fail-Press, Fail-Press-2, Minigame-Fail, Win, Drum-Roll
- **Catch** : Common-Fish, Uncommon-Fish, Rare-Fish, Epic-Fish, Legendary-Fish, Secret-Fish, Halloween-Fish, Christmas-Fish
- **Frenzy** : Frenzy1, Frenzy2
- **UI** : Button1, Wooden-Click, Cartoon-Plop, Oof, Transition, Whoosh-Thick-1

39 URLs uniques dont 8 ambient = 31 SFX. 29 noms connus → 2 sons non identifies.

Durees notables :
- 2.33s : 7 URLs uniques → catch jingles (8 noms pour 7 URLs, un nom n'a pas de son propre ou partage une URL)
- 2.31s : 2 URLs → Frenzy1, Frenzy2
- Durees en doublon (0.74s x2, 0.43s x2, 0.37s x2) → identification par index ou observation

## Sequence d'appels lors de la peche

Observe via stack capture sur `Howl.prototype.play` :
```
castLine() → setTimeout 350ms → "Swing"
           → setTimeout 375ms → "Cast"
           → setTimeout 725ms → "Cast-Impact"
```

Les indices Howl qui fire lors d'un cycle peche complet : 27, 12, 13, 16 (a confirmer via console).

## Hook SFX : flow

1. `initSoundHook()` appele au boot (apres webpack-spy, avant WS hook)
2. Retry toutes les 1s jusqu'a ce que `Howl` existe (max 30 retries)
3. Patch `Howl.prototype.play` avec un hook permanent :
   - Si `taggingName` non-null → phase tagging : enregistre `_ltName` + URL dans `urlToName`, retourne 0
   - Sinon → phase normale : resout le nom via `_ltName` ou `urlToName.get(src)`, verifie `mutedSounds`, laisse passer ou bloque
4. `scheduleTagging()` en background : retry `findPlaySoundFn` toutes les 1s (max 30)
5. Si `findPlaySoundFn` trouve la fonction → `runTagging()` : appelle `playSound(name)` pour chaque SFX_NAMES, le hook capture chaque URL
6. Map `urlToName` persistee en localStorage (`soundUrlMap`) → survit aux reloads

### Etats

- `isHooked()` : `Howl.prototype.play` est patche → true des que Howl existe
- `isTagged()` : la map URL→nom est peuplee (soit depuis le cache localStorage, soit apres tagging reussi)

### Resilience aux mises a jour

- URLs changent a chaque build → le cache `soundUrlMap` devient invalide
- `scheduleTagging` re-tague automatiquement si `findPlaySoundFn` fonctionne
- Si `findPlaySoundFn` echoue (signature change) : le hook est actif mais les sons ne sont pas identifies → muting ne marche pas
- Signature actuelle de detection : `sfxVolume` + `.rate(` + `.play()` dans le source de la fonction

## Musique : systeme de pause

`Audio.prototype.play` patche au boot (`initMusicPauseHook`).
- Capture le premier `HTMLAudioElement` avec un `.src` (= element musique du jeu)
- `musicPaused = true` → `play()` retourne `Promise.resolve()` sans jouer
- Changement de chanson (`src !== lastSrc`) → reset le flag pause si pas bloque

Le flag `__ltLocal` sur un element audio le marque comme "notre" (local player) → pas intercepte par le hook.

## Musique : volume

Via `useSettings.getState().settings.playlistVolume` (0-100).
- Mute = set playlistVolume a 0, sauvegarde ancienne valeur dans localStorage (`musicVolumeBefore`)
- Unmute = restore ancienne valeur (default 50)

## Musique : local mode (music-player.ts)

Quand l'utilisateur pause la musique du jeu, le mod peut prendre le relais avec son propre player :
- Queue construite via le sync function du jeu (module 68532, export `I`)
- Audio telecharge et cache en IndexedDB (`ltmod_music`)
- Prefetch 3 chansons a l'avance
- Volume suit la meme courbe exponentielle que le jeu : `(e^(v/100*3)-1)/(e^3-1)`
- Persistance d'etat en IndexedDB → restore apres reload

## Musique : info chanson (music-info.ts)

`getCurrentSong()` appelle `require(68532).I(timeDifference, legacyMode, streamerMode)` → retourne la chanson en cours selon le temps serveur.
- `timeDifference` : offset local/serveur (ms) depuis `useSettings.getState().timeDifference`
- Retourne : `{ song, positionInSeconds, nextSongStartIn }`
- Images : `https://utfs.io/a/3c8oj5o1o1/` + `song.imageId`

Ne pas hardcoder le module ID (68532). A scanner par signature si besoin.

## Pieges connus

- `Howl._src` peut etre string OU string[] selon la version de Howler → toujours normaliser via `Array.isArray`
- `require.c` est vide en v2 — iterer les chunks webpack a la place
- Les Howl ambient (idx 2-9) ont des durees longues (30-600s) — ne pas les inclure dans les SFX
- `console.warn` doit etre supprime pendant le scan webpack (PixiJS Proxy deprecation warnings)
- Le tagging appelle `playSound()` pour chaque nom → le hook intercepte et retourne 0, mais `console.warn` du jeu peut fire si le volume store n'est pas pret
- Preview appelle `origPlay.call(howl)` directement (bypass le hook) → pas besoin de toggle temporaire du mute set
