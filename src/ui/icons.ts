// Centralized icon library — all SVG icons used across the HUD.
// Each icon is a function returning an SVG string, with configurable size.

function icon(viewBox: number, content: string, size: number): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + viewBox + " " + viewBox +
    '" fill="currentColor" style="vertical-align:-2px;flex-shrink:0;">' + content + "</svg>";
}

function iconStroke(viewBox: number, content: string, size: number): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + viewBox + " " + viewBox +
    '" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"' +
    ' style="vertical-align:-2px;flex-shrink:0;">' + content + "</svg>";
}

// ── Phosphor icons (viewBox 256) ──

const COIN_PATH = '<path d="M184,89.57V84c0-25.08-37.83-44-88-44S8,58.92,8,84v40c0,20.89,26.25,37.49,64,42.46V172c0,25.08,37.83,44,88,44s88-18.92,88-44V132C248,111.3,222.58,94.68,184,89.57ZM56,146.87C36.41,141.4,24,132.39,24,124V109.93c8.16,5.78,19.09,10.44,32,13.57Zm80-23.37c12.91-3.13,23.84-7.79,32-13.57V124c0,8.39-12.41,17.4-32,22.87Zm-16,71.37C100.41,189.4,88,180.39,88,172v-4.17c2.63.1,5.29.17,8,.17,3.88,0,7.67-.13,11.39-.35A121.92,121.92,0,0,0,120,171.41Zm0-44.62A163,163,0,0,1,96,152a163,163,0,0,1-24-1.75V126.46A183.74,183.74,0,0,0,96,128a183.74,183.74,0,0,0,24-1.54Zm64,48a165.45,165.45,0,0,1-48,0V174.4a179.48,179.48,0,0,0,24,1.6,183.74,183.74,0,0,0,24-1.54ZM232,172c0,8.39-12.41,17.4-32,22.87V171.5c12.91-3.13,23.84-7.79,32-13.57Z"/>';
const CART_PATH = '<path d="M230.14,58.87A8,8,0,0,0,224,56H62.68L56.6,22.57A8,8,0,0,0,48.73,16H24a8,8,0,0,0,0,16h18L67.56,172.29a24,24,0,0,0,5.33,11.27,28,28,0,1,0,44.4,8.44h45.42A27.75,27.75,0,0,0,160,204a28,28,0,1,0,28-28H91.17a8,8,0,0,1-7.87-6.57L80.13,152h116a24,24,0,0,0,23.61-19.71l12.16-66.86A8,8,0,0,0,230.14,58.87ZM104,204a12,12,0,1,1-12-12A12,12,0,0,1,104,204Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,200,204Z"/>';
const VOL_PATH = '<path d="M160,32.25V223.69a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56l-65.57-51A4,4,0,0,1,80,176.16V79.84a4,4,0,0,1,1.55-3.15l65.57-51a8,8,0,0,1,10,.16A8.27,8.27,0,0,1,160,32.25ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Zm126.77,20.84a8,8,0,0,0-.72,11.3,24,24,0,0,1,0,31.72,8,8,0,1,0,12,10.58,40,40,0,0,0,0-52.88A8,8,0,0,0,186.74,100.84Zm40.89-26.17a8,8,0,1,0-11.92,10.66,64,64,0,0,1,0,85.34,8,8,0,1,0,11.92,10.66,80,80,0,0,0,0-106.66Z"/>';
const MUTE_PATH = '<path d="M213.92,210.62a8,8,0,1,1-11.84,10.76L160,175.09v48.6a8.29,8.29,0,0,1-3.91,7.18,8,8,0,0,1-9-.56l-65.55-51A4,4,0,0,1,80,176.18V87.09L42.08,45.38A8,8,0,1,1,53.92,34.62Zm-27.21-55.46a8,8,0,0,0,11.29-.7,40,40,0,0,0,0-52.88,8,8,0,1,0-12,10.57,24,24,0,0,1,0,31.72A8,8,0,0,0,186.71,155.16Zm40.92-80.49a8,8,0,1,0-11.92,10.66,64,64,0,0,1,0,85.34,8,8,0,1,0,11.92,10.66,80,80,0,0,0,0-106.66ZM153,119.87a4,4,0,0,0,7-2.7V32.25a8.27,8.27,0,0,0-2.88-6.4,8,8,0,0,0-10-.16L103.83,59.33a4,4,0,0,0-.5,5.85ZM60,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H60a4,4,0,0,0,4-4V84A4,4,0,0,0,60,80Z"/>';

// ── Simple geometric icons (viewBox 16) ──

const PLAY_PATH = '<polygon points="5,2 5,14 13,8"/>';
const PAUSE_PATH = '<rect x="3" y="3" width="3.5" height="10" rx="1"/><rect x="9.5" y="3" width="3.5" height="10" rx="1"/>';

// ── Feather/Lucide icons (viewBox 24, stroke-based) ──

const CHEVRON_LEFT_PATH = '<polyline points="15 18 9 12 15 6"/>';
const CHEVRON_RIGHT_PATH = '<polyline points="9 18 15 12 9 6"/>';
const EXTERNAL_LINK_PATH = '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
const CHECK_PATH = '<polyline points="20 6 9 17 4 12"/>';

// ── Exported icon functions ──

export function iconCoin(size = 14): string { return icon(256, COIN_PATH, size); }
export function iconCart(size = 19): string { return icon(256, CART_PATH, size); }
export function iconVolume(size = 14): string { return icon(256, VOL_PATH, size); }
export function iconMute(size = 14): string { return icon(256, MUTE_PATH, size); }
export function iconPlay(size = 14): string { return icon(16, PLAY_PATH, size); }
export function iconPause(size = 14): string { return icon(16, PAUSE_PATH, size); }
export function iconChevronLeft(size = 16): string { return iconStroke(24, CHEVRON_LEFT_PATH, size); }
export function iconChevronRight(size = 12): string { return iconStroke(24, CHEVRON_RIGHT_PATH, size); }
export function iconExternalLink(size = 14): string { return iconStroke(24, EXTERNAL_LINK_PATH, size); }
export function iconCheck(size = 12): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">' +
    CHECK_PATH + "</svg>";
}

export function iconCheckCircle(size = 20): string {
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#5ad85a;' +
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
    iconCheck(Math.round(size * 0.6)) + "</div>";
}
