import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";

const STORAGE_KEY = "disclaimerAccepted";
const TIMER_SECONDS = 15;

export function isDisclaimerAccepted(): boolean {
  return loadData<boolean>(STORAGE_KEY, false);
}

const DISCLAIMER_HTML =
  "<h2>Modification non officielle</h2>" +
  "<p>LTModMenu est un outil de modification tiers pour lofi.town. " +
  "Il n'est ni approuvé, ni soutenu par les développeurs du jeu.</p>" +

  "<h2>Risques pour votre compte</h2>" +
  "<p>Cet outil modifie le comportement normal du client de jeu. " +
  "Certaines fonctionnalités envoient des données anormales au serveur " +
  "et sont détectables. Leur utilisation peut entraîner des sanctions " +
  "sur votre compte : restrictions temporaires, suspension ou " +
  "bannissement permanent.</p>" +

  "<h2>Détectabilité</h2>" +
  "<p>L'ensemble des fonctionnalités de cet outil sont techniquement " +
  "détectables par le serveur. Certaines le sont plus facilement :</p>" +
  "<ul>" +
  "<li>Téléportation (POIs, waypoints, vers un joueur)</li>" +
  "<li>Noclip (traverser les murs)</li>" +
  "<li>Modification de la vitesse</li>" +
  "<li>Force Fishing (pêche forcée hors zone)</li>" +
  "<li>Sit anywhere (s'asseoir hors siège)</li>" +
  "<li>Lobby switch</li>" +
  "</ul>" +
  "<p>Les autres fonctionnalités (bot de pêche, caméra libre, " +
  "hitboxes, sons, etc.) restent détectables si les développeurs " +
  "du jeu décident de les cibler.</p>" +

  "<h2>Aucune garantie</h2>" +
  "<p>Cet outil est fourni « tel quel », sans aucune garantie de " +
  "fonctionnement, de sécurité ou de compatibilité. Les développeurs " +
  "de LTModMenu ne sont en aucun cas responsables des conséquences " +
  "liées à son utilisation, y compris la perte de progression, de " +
  "données ou d'accès à votre compte.</p>" +

  "<h2>Utilisation à vos risques</h2>" +
  "<p>En acceptant, vous confirmez avoir lu et compris l'intégralité " +
  "de cet avertissement. Vous assumez l'entière responsabilité de " +
  "l'utilisation de cet outil et de ses conséquences.</p>";

export function showDisclaimer(onAccepted: () => void): void {
  const overlay = document.createElement("div");
  overlay.id = "lt-disclaimer";

  overlay.innerHTML =
    '<div class="lt-disc-card">' +
    '<div class="lt-disc-header">' +
    '<div class="lt-disc-icon">!</div>' +
    '<div class="lt-disc-title">AVERTISSEMENT</div>' +
    '<div class="lt-disc-subtitle">Veuillez lire attentivement avant de continuer</div>' +
    "</div>" +
    '<div class="lt-disc-body">' +
    '<div class="lt-disc-content">' + DISCLAIMER_HTML + "</div>" +
    '<div class="lt-disc-fade"></div>' +
    "</div>" +
    '<div class="lt-disc-footer">' +
    '<div class="lt-disc-scroll-hint" id="lt-disc-hint">' +
    '<span class="lt-disc-arrow">&#8595;</span> Scrollez pour lire l\'intégralité' +
    "</div>" +
    '<button class="lt-disc-accept" id="lt-disc-accept" disabled>Accepter (' + TIMER_SECONDS + 's)</button>' +
    "</div>" +
    "</div>";

  document.body.appendChild(overlay);

  const content = overlay.querySelector(".lt-disc-content") as HTMLElement;
  const fade = overlay.querySelector(".lt-disc-fade") as HTMLElement;
  const acceptBtn = document.getElementById("lt-disc-accept") as HTMLButtonElement;
  const hint = document.getElementById("lt-disc-hint") as HTMLElement;

  let remaining = TIMER_SECONDS;
  let scrolledToBottom = false;

  function updateButton(): void {
    if (remaining > 0) {
      acceptBtn.textContent = "Accepter (" + remaining + "s)";
      acceptBtn.disabled = true;
      acceptBtn.className = "lt-disc-accept lt-disc-locked";
    } else if (!scrolledToBottom) {
      acceptBtn.textContent = "Scrollez jusqu'en bas";
      acceptBtn.disabled = true;
      acceptBtn.className = "lt-disc-accept lt-disc-locked";
    } else {
      acceptBtn.textContent = "J'ai lu et j'accepte les risques";
      acceptBtn.disabled = false;
      acceptBtn.className = "lt-disc-accept lt-disc-ready";
    }
  }

  content.addEventListener("scroll", () => {
    const threshold = content.scrollHeight - content.clientHeight - 20;
    if (content.scrollTop >= threshold) {
      scrolledToBottom = true;
      hint.style.display = "none";
      fade.style.opacity = "0";
      updateButton();
    }
  });

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      clearInterval(interval);
    }
    updateButton();
  }, 1000);

  updateButton();

  acceptBtn.onclick = () => {
    if (acceptBtn.disabled) return;
    saveData(STORAGE_KEY, true);
    log("DISCLAIMER", "User accepted disclaimer");
    overlay.classList.add("lt-disc-exit");
    setTimeout(() => {
      overlay.remove();
      onAccepted();
    }, 300);
  };
}
