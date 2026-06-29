const RU_TO_EN: Record<string, string> = {
  'сша': 'USA',
  'англия': 'England',
  'шотландия': 'Scotland',
  'уэльс': 'Wales',
  'германия': 'Germany',
  'франция': 'France',
  'испания': 'Spain',
  'португалия': 'Portugal',
  'италия': 'Italy',
  'нидерланды': 'Netherlands',
  'бельгия': 'Belgium',
  'швейцария': 'Switzerland',
  'австрия': 'Austria',
  'польша': 'Poland',
  'украина': 'Ukraine',
  'турция': 'Turkey',
  'норвегия': 'Norway',
  'греция': 'Greece',
  'сербия': 'Serbia',
  'хорватия': 'Croatia',
  'дания': 'Denmark',
  'чехия': 'Czechia',
  'бразилия': 'Brazil',
  'аргентина': 'Argentina',
  'уругвай': 'Uruguay',
  'парагвай': 'Paraguay',
  'эквадор': 'Ecuador',
  'мексика': 'Mexico',
  'канада': 'Canada',
  'коста-рика': 'Costa Rica',
  'коста рика': 'Costa Rica',
  'чили': 'Chile',
  'колумбия': 'Colombia',
  'перу': 'Peru',
  'панама': 'Panama',
  'япония': 'Japan',
  'китай': 'China',
  'катар': 'Qatar',
  'иран': 'Iran',
  'саудовская аравия': 'Saudi Arabia',
  'южная корея': 'South Korea',
  'австралия': 'Australia',
  'новая зеландия': 'New Zealand',
  'марокко': 'Morocco',
  'тунис': 'Tunisia',
  'камерун': 'Cameroon',
  'камэрон': 'Cameroon',
  'египет': 'Egypt',
  'гана': 'Ghana',
  'нигерия': 'Nigeria',
  'сенегал': 'Senegal',
  'юар': 'South Africa',
  'алжир': 'Algeria',
  'кюрасао': 'Curacao',
  "кот-д'ивуар": "Cote d'Ivoire",
  'кот-д’ивуар': "Cote d'Ivoire",
  'узбекистан': 'Uzbekistan',
  'кабо-верде': 'Cape Verde',
  'кот д ивуар': "Cote d'Ivoire",
  'др конго': 'DR Congo',
  'иордания': 'Jordan',
  'ирак': 'Iraq',
  'швеция': 'Sweden',
};

function normalizeRuName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ');
}

export function olimpbetTeamToWcEnglish(name: string): string | null {
  const key = normalizeRuName(name);
  if (RU_TO_EN[key]) return RU_TO_EN[key];

  const stripped = key
    .replace(/^сборная\s+/, '')
    .replace(/\s+\(.*\)$/, '')
    .trim();
  if (RU_TO_EN[stripped]) return RU_TO_EN[stripped];

  return null;
}

export function teamsMatchLoose(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;

  const enA = olimpbetTeamToWcEnglish(a);
  const enB = olimpbetTeamToWcEnglish(b);
  if (enA && enB && enA.toLowerCase() === enB.toLowerCase()) return true;
  if (enA && enA.toLowerCase() === nb) return true;
  if (enB && enB.toLowerCase() === na) return true;

  return na.includes(nb) || nb.includes(na);
}
