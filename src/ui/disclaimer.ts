import { loadData, saveData } from "@core/storage";
import { log } from "@core/logger";

const STORAGE_KEY = "disclaimerAccepted";
const TIMER_SECONDS = 15;

export function isDisclaimerAccepted(): boolean {
  return loadData<boolean>(STORAGE_KEY, false);
}

interface I18n {
  title: string;
  subtitle: string;
  html: string;
  scrollHint: string;
  timerBtn: (s: number) => string;
  scrollBtn: string;
  acceptBtn: string;
}

const FR: I18n = {
  title: "AVERTISSEMENT",
  subtitle: "Veuillez lire attentivement avant de continuer",
  html:
    "<h2>Modification non officielle</h2>" +
    "<p>LTModMenu est un outil de modification tiers pour lofi.town. " +
    "Il n'est ni approuv\u00e9, ni soutenu par les d\u00e9veloppeurs du jeu.</p>" +
    "<h2>Risques pour votre compte</h2>" +
    "<p>Cet outil modifie le comportement normal du client de jeu. " +
    "Certaines fonctionnalit\u00e9s envoient des donn\u00e9es anormales au serveur " +
    "et sont d\u00e9tectables. Leur utilisation peut entra\u00eener des sanctions " +
    "sur votre compte : restrictions temporaires, suspension ou " +
    "bannissement permanent.</p>" +
    "<h2>D\u00e9tectabilit\u00e9</h2>" +
    "<p>L'ensemble des fonctionnalit\u00e9s de cet outil sont techniquement " +
    "d\u00e9tectables par le serveur. Certaines le sont plus facilement :</p>" +
    "<ul>" +
    "<li>T\u00e9l\u00e9portation (POIs, waypoints, vers un joueur)</li>" +
    "<li>Noclip (traverser les murs)</li>" +
    "<li>Modification de la vitesse</li>" +
    "<li>Force Fishing (p\u00eache forc\u00e9e hors zone)</li>" +
    "<li>Sit anywhere (s'asseoir hors si\u00e8ge)</li>" +
    "<li>Lobby switch</li>" +
    "</ul>" +
    "<p>Les autres fonctionnalit\u00e9s (bot de p\u00eache, cam\u00e9ra libre, " +
    "hitboxes, sons, etc.) restent d\u00e9tectables si les d\u00e9veloppeurs " +
    "du jeu d\u00e9cident de les cibler.</p>" +
    "<h2>Aucune garantie</h2>" +
    "<p>Cet outil est fourni \u00ab tel quel \u00bb, sans aucune garantie de " +
    "fonctionnement, de s\u00e9curit\u00e9 ou de compatibilit\u00e9. Les d\u00e9veloppeurs " +
    "de LTModMenu ne sont en aucun cas responsables des cons\u00e9quences " +
    "li\u00e9es \u00e0 son utilisation, y compris la perte de progression, de " +
    "donn\u00e9es ou d'acc\u00e8s \u00e0 votre compte.</p>" +
    "<h2>Utilisation \u00e0 vos risques</h2>" +
    "<p>En acceptant, vous confirmez avoir lu et compris l'int\u00e9gralit\u00e9 " +
    "de cet avertissement. Vous assumez l'enti\u00e8re responsabilit\u00e9 de " +
    "l'utilisation de cet outil et de ses cons\u00e9quences.</p>",
  scrollHint: "Scrollez pour lire l'int\u00e9gralit\u00e9",
  timerBtn: (s) => "Accepter (" + s + "s)",
  scrollBtn: "Scrollez jusqu'en bas",
  acceptBtn: "J'ai lu et j'accepte les risques",
};

const EN: I18n = {
  title: "WARNING",
  subtitle: "Please read carefully before continuing",
  html:
    "<h2>Unofficial modification</h2>" +
    "<p>LTModMenu is a third-party modification tool for lofi.town. " +
    "It is neither approved nor supported by the game developers.</p>" +
    "<h2>Risks to your account</h2>" +
    "<p>This tool modifies the normal behavior of the game client. " +
    "Some features send abnormal data to the server " +
    "and are detectable. Using them may result in sanctions " +
    "on your account: temporary restrictions, suspension or " +
    "permanent ban.</p>" +
    "<h2>Detectability</h2>" +
    "<p>All features of this tool are technically " +
    "detectable by the server. Some are more easily detected:</p>" +
    "<ul>" +
    "<li>Teleportation (POIs, waypoints, to a player)</li>" +
    "<li>Noclip (walk through walls)</li>" +
    "<li>Speed modification</li>" +
    "<li>Force Fishing (fishing outside designated areas)</li>" +
    "<li>Sit anywhere (sit outside seats)</li>" +
    "<li>Lobby switch</li>" +
    "</ul>" +
    "<p>Other features (fishing bot, free camera, " +
    "hitboxes, sounds, etc.) remain detectable if the game " +
    "developers decide to target them.</p>" +
    "<h2>No warranty</h2>" +
    "<p>This tool is provided \"as is\", without any warranty of " +
    "functionality, security or compatibility. The developers " +
    "of LTModMenu are in no way responsible for any consequences " +
    "related to its use, including loss of progress, " +
    "data or access to your account.</p>" +
    "<h2>Use at your own risk</h2>" +
    "<p>By accepting, you confirm that you have read and understood " +
    "this warning in its entirety. You assume full responsibility for " +
    "the use of this tool and its consequences.</p>",
  scrollHint: "Scroll to read the full disclaimer",
  timerBtn: (s) => "Accept (" + s + "s)",
  scrollBtn: "Scroll to the bottom",
  acceptBtn: "I have read and accept the risks",
};

export function showDisclaimer(onAccepted: () => void): void {
  const overlay = document.createElement("div");
  overlay.id = "lt-disclaimer";

  let lang: "fr" | "en" = "en";
  let remaining = TIMER_SECONDS;
  let scrolledToBottom = false;
  let intervalId: ReturnType<typeof setInterval>;

  const FLAG_FR = '<svg width="22" height="16" viewBox="0 0 3 2" style="display:block;border-radius:2px;"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ED2939"/></svg>';
  const FLAG_EN = '<svg width="22" height="16" viewBox="0 0 190 100" style="display:block;border-radius:2px;"><rect width="190" height="100" fill="#B22234"/><g fill="#fff"><rect y="8" width="190" height="8"/><rect y="23" width="190" height="8"/><rect y="38" width="190" height="8"/><rect y="54" width="190" height="8"/><rect y="69" width="190" height="8"/><rect y="84" width="190" height="8"/></g><rect width="76" height="54" fill="#3C3B6E"/></svg>';

  function t(): I18n { return lang === "fr" ? FR : EN; }

  function swapLang(): void {
    const i = t();
    const title = overlay.querySelector(".lt-disc-title");
    const subtitle = overlay.querySelector(".lt-disc-subtitle");
    const content = overlay.querySelector(".lt-disc-content");
    const hint = document.getElementById("lt-disc-hint");
    if (title) title.textContent = i.title;
    if (subtitle) subtitle.textContent = i.subtitle;
    if (content) content.innerHTML = i.html;
    if (hint && !scrolledToBottom) hint.innerHTML = '<span class="lt-disc-arrow">&#8595;</span> ' + i.scrollHint;
    // Update active state on lang buttons
    overlay.querySelectorAll<HTMLButtonElement>(".lt-disc-lang-btn").forEach((btn) => {
      btn.classList.toggle("lt-disc-lang-active", btn.dataset.lang === lang);
    });
    updateButton();
  }

  function render(): void {
    const prevScroll = overlay.querySelector(".lt-disc-content")?.scrollTop ?? 0;
    const i = t();
    overlay.innerHTML =
      '<div class="lt-disc-card">' +
      '<div class="lt-disc-header">' +
      '<div class="lt-disc-lang" id="lt-disc-lang">' +
      '<button class="lt-disc-lang-btn' + (lang === "fr" ? " lt-disc-lang-active" : "") + '" data-lang="fr">' + FLAG_FR + '</button>' +
      '<button class="lt-disc-lang-btn' + (lang === "en" ? " lt-disc-lang-active" : "") + '" data-lang="en">' + FLAG_EN + '</button>' +
      "</div>" +
      '<div class="lt-disc-icon">!</div>' +
      '<div class="lt-disc-title">' + i.title + "</div>" +
      '<div class="lt-disc-subtitle">' + i.subtitle + "</div>" +
      "</div>" +
      '<div class="lt-disc-body">' +
      '<div class="lt-disc-content">' + i.html + "</div>" +
      '<div class="lt-disc-fade"></div>' +
      "</div>" +
      '<div class="lt-disc-footer">' +
      '<div class="lt-disc-scroll-hint" id="lt-disc-hint">' +
      '<span class="lt-disc-arrow">&#8595;</span> ' + i.scrollHint +
      "</div>" +
      '<button class="lt-disc-accept" id="lt-disc-accept" disabled></button>' +
      "</div>" +
      "</div>";

    // Restore scroll position
    const content = overlay.querySelector(".lt-disc-content") as HTMLElement;
    content.scrollTop = prevScroll;

    // Hide hint/fade if already scrolled to bottom
    if (scrolledToBottom) {
      const hint = document.getElementById("lt-disc-hint");
      const fade = overlay.querySelector(".lt-disc-fade") as HTMLElement | null;
      if (hint) hint.style.display = "none";
      if (fade) fade.style.opacity = "0";
    }

    updateButton();

    // ── Lang toggle ──
    overlay.querySelectorAll<HTMLButtonElement>(".lt-disc-lang-btn").forEach((btn) => {
      btn.onclick = () => {
        const next = btn.dataset.lang as "fr" | "en";
        if (next === lang) return;
        lang = next;
        swapLang();
      };
    });

    // ── Scroll detection ──
    content.addEventListener("scroll", () => {
      const threshold = content.scrollHeight - content.clientHeight - 20;
      if (content.scrollTop >= threshold) {
        scrolledToBottom = true;
        const hint = document.getElementById("lt-disc-hint");
        const fade = overlay.querySelector(".lt-disc-fade") as HTMLElement | null;
        if (hint) hint.style.display = "none";
        if (fade) fade.style.opacity = "0";
        updateButton();
      }
    });

    // ── Accept ──
    const acceptBtn = document.getElementById("lt-disc-accept") as HTMLButtonElement;
    acceptBtn.onclick = () => {
      if (acceptBtn.disabled) return;
      saveData(STORAGE_KEY, true);
      log("DISCLAIMER", "User accepted disclaimer");
      clearInterval(intervalId);
      overlay.classList.add("lt-disc-exit");
      setTimeout(() => {
        overlay.remove();
        onAccepted();
      }, 300);
    };
  }

  function updateButton(): void {
    const acceptBtn = document.getElementById("lt-disc-accept") as HTMLButtonElement | null;
    if (!acceptBtn) return;
    const i = t();
    if (remaining > 0) {
      acceptBtn.textContent = i.timerBtn(remaining);
      acceptBtn.disabled = true;
      acceptBtn.className = "lt-disc-accept lt-disc-locked";
    } else if (!scrolledToBottom) {
      acceptBtn.textContent = i.scrollBtn;
      acceptBtn.disabled = true;
      acceptBtn.className = "lt-disc-accept lt-disc-locked";
    } else {
      acceptBtn.textContent = i.acceptBtn;
      acceptBtn.disabled = false;
      acceptBtn.className = "lt-disc-accept lt-disc-ready";
    }
  }

  document.body.appendChild(overlay);
  render();

  intervalId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      clearInterval(intervalId);
    }
    updateButton();
  }, 1000);
}
