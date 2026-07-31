// IMPORTANT: `WcOddsEvent.homeTeam`/`awayTeam` are usually stored in RUSSIAN —
// Olimpbet only translates to English for national teams (see
// `olimpbetTeamToWcEnglish`), club names stay Cyrillic. 1win/top-parser also
// returns Russian names by default (we request `x-lang: ru-RU`), so the
// primary match is RU-name-to-RU-name. The English `slug` 1win also exposes
// is kept as a secondary check (national teams + tennis First/Last reorder).
//
// Matching is scored (0..1) so the fixture index can run a strict pass and a
// looser fallback pass for spelling variants (Босаравонгсе/Бусаравонгсе) and
// tennis name-order flips (Фамилия Имя ↔ Имя Фамилия).

import { slugifyTeam, transliterateSlugText } from '../wc-odds/wc-slug.util';

const RU_SUFFIX_WORDS = new Set(['фк', 'ржд', 'ск', 'ж', 'м']);
const EN_SUFFIX_WORDS = new Set([
  'fc',
  'cf',
  'sc',
  'afc',
  'ac',
  'cd',
  'ca',
  'sd',
  'if',
  'bk',
  'fk',
  'club',
  'united',
  'w',
  'm',
]);

/** Initials / 2-letter country codes that shouldn't decide a match alone. */
const INITIAL_RE = /^[a-zа-яё]{1,2}$/i;

export function normalizeRuName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/э/g, 'е') // юсукэ ↔ юсуке, etc.
    // Drop parenthetical qualifiers: (Кор), (жен), (Knez) — they create
    // short-token false positives against surnames (гер ↔ герберт).
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-.,()"'«»]/g, ' ')
    .replace(/\//g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coreWords(normalized: string, suffixWords: Set<string>): string[] {
  return normalized
    .split(' ')
    .filter(
      (word) =>
        word &&
        word !== '/' &&
        !suffixWords.has(word) &&
        !INITIAL_RE.test(word),
    );
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** 0..1 string similarity; short tokens need near-exact equality. */
export function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    const ratio = shorter / longer;
    // "си" inside "динос" / "гер" inside "герберт" must NOT score 0.82.
    if (shorter < 4 || ratio < 0.55) return 0;
    return Math.max(0.82, ratio);
  }
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return 0;
  const dist = levenshtein(a, b);
  const score = 1 - dist / maxLen;
  // One-char typo on long surnames (босаравонгсе/бусаравонгсе) stays high.
  return score >= 0.72 ? score : 0;
}

/**
 * Align tokens regardless of order (tennis First↔Last). Returns mean of the
 * best pairwise similarities, gated by coverage of the smaller name.
 */
function orderedTokenScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const used = new Set<number>();
  let sum = 0;
  let hits = 0;
  const primary = a.length <= b.length ? a : b;
  const secondary = a.length <= b.length ? b : a;

  for (const token of primary) {
    let best = 0;
    let bestIdx = -1;
    for (let i = 0; i < secondary.length; i++) {
      if (used.has(i)) continue;
      const sim = tokenSimilarity(token, secondary[i]);
      if (sim > best) {
        best = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && best > 0) {
      used.add(bestIdx);
      sum += best;
      hits += 1;
    }
  }

  if (hits === 0) return 0;
  // Require matching most of the shorter name so "Смит" alone can't latch onto
  // a random multi-word club that happens to share one token. For 1–2 token
  // names (tennis), demand every token hit.
  const coverage = hits / primary.length;
  if (primary.length <= 2 && coverage < 1) return 0;
  if (coverage < 0.5) return 0;
  return (sum / hits) * (0.7 + 0.3 * coverage);
}

function nameScore(ownName: string, oneWinName: string): number {
  const a = normalizeRuName(ownName);
  const b = normalizeRuName(oneWinName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6
      ? 0.92
      : 0.7;
  }

  // Doubles: "X / Y" ↔ "X / Y" — score each side and average.
  if (a.includes('/') || b.includes('/')) {
    const partsA = a.split('/').map((p) => p.trim()).filter(Boolean);
    const partsB = b.split('/').map((p) => p.trim()).filter(Boolean);
    if (partsA.length >= 2 && partsB.length >= 2) {
      const s0 = Math.max(
        orderedTokenScore(coreWords(partsA[0], RU_SUFFIX_WORDS), coreWords(partsB[0], RU_SUFFIX_WORDS)),
        orderedTokenScore(coreWords(partsA[0], RU_SUFFIX_WORDS), coreWords(partsB[1], RU_SUFFIX_WORDS)),
      );
      const s1 = Math.max(
        orderedTokenScore(coreWords(partsA[1], RU_SUFFIX_WORDS), coreWords(partsB[0], RU_SUFFIX_WORDS)),
        orderedTokenScore(coreWords(partsA[1], RU_SUFFIX_WORDS), coreWords(partsB[1], RU_SUFFIX_WORDS)),
      );
      return (s0 + s1) / 2;
    }
  }

  return orderedTokenScore(coreWords(a, RU_SUFFIX_WORDS), coreWords(b, RU_SUFFIX_WORDS));
}

function slugScore(ownName: string, oneWinSlug: string): number {
  const ownSlug = slugifyTeam(ownName);
  const theirSlug = oneWinSlug.trim().toLowerCase().replace(/^-+|-+$/g, '');
  if (!ownSlug || !theirSlug) return 0;
  if (ownSlug === theirSlug) return 1;
  if (ownSlug.includes(theirSlug) || theirSlug.includes(ownSlug)) {
    return Math.min(ownSlug.length, theirSlug.length) /
      Math.max(ownSlug.length, theirSlug.length) >= 0.55
      ? 0.9
      : 0.65;
  }

  const wordsA = coreWords(ownSlug.replace(/-/g, ' '), EN_SUFFIX_WORDS);
  const wordsB = coreWords(theirSlug.replace(/-/g, ' '), EN_SUFFIX_WORDS);
  const aligned = orderedTokenScore(wordsA, wordsB);
  if (aligned > 0) return aligned;

  // Last-resort: compare transliterated raw name tokens to slug tokens
  // (covers cases where slugify collapsed something oddly).
  const raw = coreWords(
    transliterateSlugText(normalizeRuName(ownName)).replace(/[^a-z0-9]+/g, ' '),
    EN_SUFFIX_WORDS,
  );
  return orderedTokenScore(raw, wordsB);
}

/** Strict boolean used by older call sites — kept for compatibility. */
export function teamNamesMatchLoose(
  ownName: string,
  oneWinName: string,
): boolean {
  return nameScore(ownName, oneWinName) >= 0.75;
}

export function slugifyTeamName(name: string): string {
  return slugifyTeam(name);
}

export function teamSlugsMatchLoose(
  ownName: string,
  oneWinSlug: string,
): boolean {
  return slugScore(ownName, oneWinSlug) >= 0.75;
}

/** 0..1 confidence that `ownName` refers to the same competitor as `oneWinTeam`. */
export function oneWinTeamMatchScore(
  ownName: string,
  oneWinTeam: { name: string; slug: string },
): number {
  return Math.max(nameScore(ownName, oneWinTeam.name), slugScore(ownName, oneWinTeam.slug));
}

export function oneWinTeamMatches(
  ownName: string,
  oneWinTeam: { name: string; slug: string },
): boolean {
  return oneWinTeamMatchScore(ownName, oneWinTeam) >= 0.75;
}
