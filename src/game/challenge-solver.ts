export function solveFishingChallenge(e: string): string {
  console.log("[LTModMenu] Solving challenge, length:", e.length);

  const a = [114, 51, 97, 108, 109, 115];
  let t = 0x811c9dc5;
  const i: number[] = [];

  for (let o = 0; o < e.length; o++) {
    t ^= e.charCodeAt(o) ^ a[o % a.length];
    t = Math.imul(t, 0x1000193);
    i.push((t >>> 0) & 255);
  }

  const result = i.map((e) => e.toString(16).padStart(2, "0")).join("");
  console.log("[LTModMenu] Challenge solved, response length:", result.length);
  return result;
}

export function setupChallengeSolver(): void {
  window.__solveFishingChallenge = solveFishingChallenge;
}
