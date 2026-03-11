/** Site CSS variable names used by lofi.town on <html> */
export const SITE_VARS = {
  primary: "--theme-primary",
  primaryDark: "--theme-primary-dark",
  primaryHover: "--theme-primary-hover",
  accent: "--theme-accent",
  accentAlt: "--theme-accent-alt",
  accentHover: "--theme-accent-hover",
  text: "--theme-text",
  textAlt: "--theme-text-alt",
  textMuted: "--theme-text-muted",
  icon: "--theme-icon",
  positive: "--theme-positive",
} as const;

/** Default HUD colors (original purple theme, used as fallback) */
export const DEFAULT_COLORS = {
  bg: "#1e1e3a",
  bgSecondary: "#2a2a50",
  border: "#3a3a6a",
  borderLight: "#4a4a7a",
  text: "#c8c0e0",
  textMuted: "#6a6a9a",
  textTitle: "#b8b0d8",
  inputBg: "#14142a",
  accent: "#6a6abe",
  shadow: "rgba(0,0,0,0.5)",
};

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
