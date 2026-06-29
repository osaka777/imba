#!/usr/bin/env node
/** One-off: rebuild broken WC event slugs (e.g. `-vs--8277133`). */
const { PrismaClient } = require('@prisma/client');

const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ü: 'u', ү: 'u', һ: 'h', і: 'i',
};

function transliterate(value) {
  let result = '';
  for (const char of value.normalize('NFC')) {
    const lower = char.toLowerCase();
    result += CYRILLIC_TO_LATIN[lower] ?? char;
  }
  return result;
}

function slugifyTeam(name) {
  return transliterate(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function baseWcSlug(homeTeam, awayTeam) {
  const home = slugifyTeam(homeTeam);
  const away = slugifyTeam(awayTeam);
  if (!home && !away) return 'match';
  if (!home) return `${away}-vs-team`;
  if (!away) return `${home}-vs-team`;
  return `${home}-vs-${away}`;
}

function isBrokenWcSlug(slug) {
  if (!slug?.trim()) return true;
  const normalized = slug.trim().toLowerCase();
  const match = /^(.+)-vs-(.+)$/.exec(normalized);
  if (!match) return normalized.includes('-vs-');
  const home = match[1].replace(/^-+|-+$/g, '');
  const away = match[2]
    .replace(/-\d{2}-\d{2}$/, '')
    .replace(/-\d+$/, '')
    .replace(/^-+|-+$/g, '');
  return home.length === 0 || away.length === 0;
}

function wcSlugDateSuffix(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}`;
}

async function buildUniqueWcSlug(prisma, homeTeam, awayTeam, commenceTime, eventId) {
  const base = baseWcSlug(homeTeam, awayTeam);
  const olimpbetSuffix = eventId.replace(/^ol-/, '');
  const candidates = [
    `${base}-${wcSlugDateSuffix(commenceTime)}`,
    `${base}-${olimpbetSuffix}`,
    `${base}-${wcSlugDateSuffix(commenceTime)}-${olimpbetSuffix}`,
  ];

  for (const slug of candidates) {
    const clash = await prisma.wcOddsEvent.findFirst({
      where: { slug, id: { not: eventId } },
    });
    if (!clash) return slug;
  }

  return `${base}-${olimpbetSuffix}`;
}

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.wcOddsEvent.findMany({
    where: {
      OR: [
        { slug: { startsWith: '-vs-' } },
        { slug: { startsWith: 'vs-' } },
      ],
    },
    select: {
      id: true,
      slug: true,
      homeTeam: true,
      awayTeam: true,
      commenceTime: true,
    },
  });

  let repaired = 0;
  for (const row of rows) {
    if (!isBrokenWcSlug(row.slug)) continue;
    const slug = await buildUniqueWcSlug(
      prisma,
      row.homeTeam,
      row.awayTeam,
      row.commenceTime,
      row.id,
    );
    await prisma.wcOddsEvent.update({ where: { id: row.id }, data: { slug } });
    repaired += 1;
    console.log(`${row.slug} -> ${slug}`);
  }

  console.log(`Repaired ${repaired} slug(s)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
