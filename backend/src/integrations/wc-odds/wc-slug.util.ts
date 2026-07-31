import { PrismaService } from '~/prisma/prisma.service';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ә: 'a',
  ғ: 'g',
  қ: 'q',
  ң: 'n',
  ө: 'o',
  ұ: 'u',
  ü: 'u',
  ү: 'u',
  һ: 'h',
  і: 'i',
};

export function transliterateSlugText(value: string): string {
  let result = '';
  for (const char of value.normalize('NFC')) {
    const lower = char.toLowerCase();
    if (CYRILLIC_TO_LATIN[lower] != null) {
      result += CYRILLIC_TO_LATIN[lower];
      continue;
    }
    result += char;
  }
  return result;
}

export function slugifyTeam(name: string): string {
  return transliterateSlugText(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function baseWcSlug(homeTeam: string, awayTeam: string): string {
  const home = slugifyTeam(homeTeam);
  const away = slugifyTeam(awayTeam);
  if (!home && !away) return 'match';
  if (!home) return `${away}-vs-team`;
  if (!away) return `${home}-vs-team`;
  return `${home}-vs-${away}`;
}

/** Slugs like `-vs--8277133` when Cyrillic team names were not transliterated. */
export function isBrokenWcSlug(slug: string | null | undefined): boolean {
  if (!slug?.trim()) return true;

  const normalized = slug.trim().toLowerCase();
  const match = /^(.+)-vs-(.+)$/.exec(normalized);
  if (!match) return normalized.includes('-vs-');

  const home = match[1].replace(/^-+|-+$/g, '');
  const away = match[2]
    .replace(/-\d{2}-\d{2}$/, '')
    .replace(/-\d+$/, '')
    .replace(/^-+|-+$/g, '');

  if (home.length === 0 || away.length === 0) return true;
  if (/^\d+$/.test(home) && /^\d+$/.test(away)) return true;

  return false;
}

export function olimpbetIdFromSlugHint(ref: string): string | null {
  const decoded = decodeURIComponent(ref).trim();
  const ugly = decoded.match(/-vs-+(\d{5,})$/i);
  if (ugly) return `ol-${ugly[1]}`;

  const trailing = decoded.match(/-(\d{5,})$/);
  if (trailing) return `ol-${trailing[1]}`;

  return null;
}

export function wcSlugDateSuffix(commenceTime: Date): string {
  const dd = String(commenceTime.getUTCDate()).padStart(2, '0');
  const mm = String(commenceTime.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}`;
}

export function wcEventIdFromOlimpbet(olimpbetEventId: number): string {
  return `ol-${olimpbetEventId}`;
}

export function wcEventIdFromOneWin(matchId: number): string {
  return `ow-${matchId}`;
}

export function olimpbetIdFromWcEventId(eventId: string): number | null {
  const prefixed = eventId.match(/^ol-(\d+)$/);
  if (prefixed) return Number(prefixed[1]);

  if (/^\d+$/.test(eventId)) return Number(eventId);
  return null;
}

export function oneWinMatchIdFromWcEventId(eventId: string): number | null {
  const prefixed = eventId.match(/^ow-(\d+)$/i);
  if (prefixed) return Number(prefixed[1]);
  return null;
}

/** Deterministic per-event slug — collision-proof because event ids are unique. */
export function wcSlugWithEventId(
  homeTeam: string,
  awayTeam: string,
  eventId: string,
): string {
  return `${baseWcSlug(homeTeam, awayTeam)}-${eventId.replace(/^(ol|ow)-/i, '')}`;
}

export async function buildUniqueWcSlug(
  prisma: PrismaService,
  homeTeam: string,
  awayTeam: string,
  commenceTime: Date,
  eventId: string,
): Promise<string> {
  const base = baseWcSlug(homeTeam, awayTeam);
  const idSlug = wcSlugWithEventId(homeTeam, awayTeam, eventId);
  const candidates = [
    `${base}-${wcSlugDateSuffix(commenceTime)}`,
    idSlug,
    `${base}-${wcSlugDateSuffix(commenceTime)}-${eventId.replace(/^(ol|ow)-/i, '')}`,
  ];

  for (const slug of candidates) {
    const clash = await prisma.wcOddsEvent.findFirst({
      where: { slug, id: { not: eventId } },
    });
    if (!clash) return slug;
  }

  return idSlug;
}

export function isWcEventId(ref: string): boolean {
  return (
    /^ol-\d+$/i.test(ref) ||
    /^ow-\d+$/i.test(ref) ||
    /^[a-f0-9]{32}$/i.test(ref)
  );
}

export function stripLegacyHashFromSlug(slug: string): string {
  return slug.replace(/-[a-f0-9]{32}$/i, '');
}
