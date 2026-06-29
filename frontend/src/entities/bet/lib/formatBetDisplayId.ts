/** Stable 6-digit ticket number for UI (same bet → same number). */
export function formatBetDisplayId(betId: number): string {
  let h = Math.abs(Math.trunc(betId)) || 1;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return String((h % 900_000) + 100_000);
}
