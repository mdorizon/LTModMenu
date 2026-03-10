# LTModMenu - Lofi Town Mod Menu

Userscript (Tampermonkey) de type mod menu pour [Lofi Town](https://lofi.town/), avec bot de peche automatique, teleportation, waypoints et statistiques detaillees.

**Version :** 2.2
**Auteur :** mdorizon

## Installation

1. Installer [Tampermonkey](https://www.tampermonkey.net/) sur ton navigateur
2. Creer un nouveau userscript et coller le contenu de `ltmodmenu.user.js`
3. Aller sur [lofi.town](https://lofi.town/) — le menu apparait automatiquement

## Fonctionnalites

### Auto Fishing Bot

Bot de peche entierement automatise :

- Detection et clic automatique des boutons CAST et REEL
- Resolution automatique des challenges (algorithme FNV-1a)
- Collecte des resultats et fermeture des popups
- Blocage des echecs de peche (empeche le serveur d'enregistrer les fails)
- Boucle continue avec delais humanises (100-200ms aleatoires)
- Timeouts intelligents (45s cast, 10s resultat)
- Bouton START/STOP avec timer de session

### Statistiques de peche

Suivi detaille avec sauvegarde automatique (toutes les 30s via localStorage) :

- Nombre total de poissons attrapes
- Or total gagne (calcul base sur le poids et la rarete)
- Compteurs par rarete : Common, Uncommon, Rare, Epic, Legendary, Secret, Event
- Dernier poisson attrape (nom, poids, rarete, or, shiny)
- Detection des poissons shiny (x50 or)
- Bouton de reset des stats

### Base de donnees poissons

54 especes repertoriees avec poids min/max et or de base :

| Rarete | Nombre | Exemples |
|--------|--------|----------|
| Common | 12 | Bass, Cod, Shrimp, Lobster... |
| Uncommon | 11 | Puffer Fish, Tuna, Seahorse... |
| Rare | 7 | Goldfish, Koi Carp, Blobfish... |
| Epic | 11 | Blue Lobster, Tiger Shark, Octopus... |
| Legendary | 10 | Golden Goldfish, Cthulhu, Megalodon... |
| Secret | 7 | Goblin Shark, Ghost Shark, Barreleye Fish... |
| Event | 12 | Halloween (Vampire Squid, Nessie...) + Christmas (Narwhal, Walrus...) |

### Teleportation

- **Points d'interet fixes :** Fishing Spot (860, 380), Merchant (793, 198)
- **Waypoints personnalises :** sauvegarder la position actuelle avec un nom, teleportation en un clic, suppression individuelle
- Synchronisation avec le serveur via WebSocket (position + direction)

### Actions joueur

- **S'asseoir** — force l'animation assise
- **Forcer la peche** — lance l'animation de peche a la position actuelle
- **Se lever** — retour en position debout (sans cooldown)

## Interface

Menu draggable fixe sur la gauche de l'ecran avec 4 sections :

1. **Saved Locations** — POI fixes + waypoints custom
2. **Teleport Options** — gestion des waypoints (ajout/suppression)
3. **Player Actions** — actions manuelles (sit, fish, stand)
4. **Auto Fishing** — controle du bot, timer, statistiques en temps reel

Theme sombre Lofi Town (navy + lavande), police custom HabitSmall.

## Fonctionnement technique

- Injection dans le contexte page (bypass sandbox Tampermonkey)
- Interception du WebSocket natif pour monitorer/envoyer des messages
- Hook webpack pour capturer l'instance App du jeu (`localPlayer`, positions, minigames)
- Sauvegarde persistante via localStorage (prefix `ltmod_`)

## Variables globales (console)

| Variable | Description |
|----------|-------------|
| `window.__gameWS` | Connexion WebSocket |
| `window.__gameApp` | Instance App du jeu |
| `window.__playerPos` | Derniere position connue |
| `window.__fishStats` | Statistiques de peche |
| `window.__waypoints` | Waypoints sauvegardes |
| `window.__botPaused` | Etat pause du bot |
| `window.__solveFishingChallenge(c)` | Resoudre un challenge manuellement |
| `window.__forceEndMinigame()` | Forcer la fin du minigame |

## Fichiers

| Fichier | Description |
|---------|-------------|
| `ltmodmenu.user.js` | Userscript principal (mod menu) |
| `bot_playwright.py` | Bot de peche alternatif (Playwright/WebKit) |
| `calibrate_browser.py` | Calibration pour le bot Playwright |
| `fishing_bot.py` | Bot desktop (pyautogui/mss) |
| `calibrate.py` | Calibration desktop |
| `config.json` | Positions calibrees |
| `session/` | Session de connexion sauvegardee |
