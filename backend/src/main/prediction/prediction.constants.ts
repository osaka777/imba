export const PREDICTION_MIN_STAKE: Record<string, number> = {
  KZT: 100,
  USD: 1,
  USDT: 1,
  RUB: 50,
};

/** Max single stake — $500,000 (KZT/RUB at ~500₸/$ and ~100₽/$). */
export const PREDICTION_MAX_STAKE: Record<string, number> = {
  KZT: 250_000_000,
  USD: 500_000,
  USDT: 500_000,
  RUB: 50_000_000,
};

/** Max potential payout exposure on a single outcome (house liability). */
export const PREDICTION_MAX_OUTCOME_EXPOSURE = 100_000_000;

/** Max stake sum per user on one event (must cover largest currency max). */
export const PREDICTION_MAX_USER_STAKE_PER_EVENT = 250_000_000;

/** Max bets per user on one event. */
export const PREDICTION_MAX_USER_BETS_PER_EVENT = 10;

export function predictionMinStake(currencyCode: string): number {
  return PREDICTION_MIN_STAKE[currencyCode.toUpperCase()] ?? 100;
}

export function predictionMaxStake(currencyCode: string): number {
  return PREDICTION_MAX_STAKE[currencyCode.toUpperCase()] ?? 500_000;
}

/** Approx FX for volume display (matches max-stake ratios). USD/USDT = 1. */
const PREDICTION_USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  USDT: 1,
  KZT: 1 / 500,
  RUB: 1 / 100,
};

export function predictionStakeToUsd(stake: number, currencyCode: string): number {
  const rate = PREDICTION_USD_PER_UNIT[currencyCode.toUpperCase()] ?? 1;
  if (!Number.isFinite(stake) || stake <= 0) return 0;
  return stake * rate;
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
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
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
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
  ү: 'u',
  һ: 'h',
  і: 'i',
};

function transliterateForSlug(value: string): string {
  let out = '';
  for (const ch of value.normalize('NFC')) {
    const lower = ch.toLowerCase();
    if (CYRILLIC_TO_LATIN[lower] != null) {
      out += CYRILLIC_TO_LATIN[lower];
      continue;
    }
    out += ch;
  }
  return out;
}

/** ASCII URL slug: transliterate Cyrillic, keep a-z0-9 and hyphens. */
export function slugifyTitle(title: string): string {
  const base = transliterateForSlug(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `event-${Date.now()}`;
}
