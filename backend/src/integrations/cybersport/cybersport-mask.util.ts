/** Mask third-party bookmaker branding in cybersport UI. */
const OLIMP_PATTERNS: RegExp[] = [
  /olimpbet\.kz/gi,
  /\bolimp[\s-]?bet\b/gi,
  /\bolimp\b/gi,
];

const GENERIC_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bbet365\b/gi, ''],
  [/\b1xbet\b/gi, ''],
  [/\bfonbet\b/gi, ''],
];

export function maskCybersportLabel(raw: string | null | undefined): string {
  if (!raw) return '';

  let value = raw.trim();
  for (const pattern of OLIMP_PATTERNS) {
    value = value.replace(pattern, 'Imba');
  }
  for (const [pattern, replacement] of GENERIC_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  return value
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

export function maskCybersportTeamName(raw: string | null | undefined): string {
  return maskCybersportLabel(raw);
}

export function isCyberGameRef(eventId: string): boolean {
  return /^cyber-\d+$/.test(eventId);
}

export function cyberGameRefFromOlimpbetId(olimpbetEventId: number): string {
  return `cyber-${olimpbetEventId}`;
}

export function olimpbetIdFromCyberGameRef(eventId: string): number | null {
  const match = /^cyber-(\d+)$/.exec(eventId);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}
