export interface ModalButton {
  label: string;
  style?: "danger" | "warning" | "success" | "default";
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  message: string;
  style?: "danger" | "warning" | "default";
  buttons: ModalButton[];
}

const borderColors: Record<string, string> = {
  danger: "#6a2a2a",
  warning: "#6a5a2a",
  default: "var(--lt-border, #3a3a6a)",
};

const titleColors: Record<string, string> = {
  danger: "#be6a6a",
  warning: "#d4a44a",
  default: "var(--lt-text-title, #b8b0d8)",
};

const btnStyles: Record<string, string> = {
  danger: "background:#3a1a1a;border-color:#6a2a2a;color:#be6a6a",
  warning: "background:#3a2a1a;border-color:#6a5a2a;color:#d4a44a",
  success: "background:#1a3a1a;border-color:#2a6a2a;color:#6abe6a",
  default: "background:var(--lt-bg, #1e1e3a);border-color:var(--lt-border, #3a3a6a);color:var(--lt-text-muted, #8a8aaa)",
};

export function showModal(opts: ModalOptions): void {
  const modalStyle = opts.style || "default";
  const overlay = document.createElement("div");
  overlay.id = "lt-modal-overlay";

  const buttonsHtml = opts.buttons
    .map((btn, i) => {
      const s = btnStyles[btn.style || "default"];
      return '<button class="lt-modal-btn" data-idx="' + i + '" style="' + s + '">' + btn.label + "</button>";
    })
    .join("");

  overlay.innerHTML =
    '<div id="lt-modal" style="border-color:' + borderColors[modalStyle] + '">' +
    '<div id="lt-modal-title" style="color:' + titleColors[modalStyle] + '">' + opts.title + "</div>" +
    '<div id="lt-modal-msg">' + opts.message + "</div>" +
    '<div id="lt-modal-actions">' + buttonsHtml + "</div></div>";

  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.querySelectorAll<HTMLButtonElement>(".lt-modal-btn").forEach((btn) => {
    const idx = parseInt(btn.dataset.idx || "0", 10);
    btn.onclick = () => {
      close();
      opts.buttons[idx].onClick();
    };
  });
}
