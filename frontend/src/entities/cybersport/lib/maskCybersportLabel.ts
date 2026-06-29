const OLIMP_PATTERNS: RegExp[] = [
  /olimpbet\.kz/gi,
  /\bolimp[\s-]?bet\b/gi,
  /\bolimp\b/gi,
];

export function maskCybersportLabel(raw: string | null | undefined): string {
  if (!raw) return "";

  let value = raw.trim();
  for (const pattern of OLIMP_PATTERNS) {
    value = value.replace(pattern, "Imba");
  }

  return value
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isCyberGameRef(eventId: string): boolean {
  return /^cyber-\d+$/.test(eventId);
}
