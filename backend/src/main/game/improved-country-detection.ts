/**
 * Улучшенная функция для определения страны по названию лиги
 * Скопируйте этот код в метод determineCountryFromLeagueName в LeagueService
 */

const russianCountryMap: Record<string, string> = {
  // Россия
  'россия': 'russia',
  'россии': 'russia',
  'российский': 'russia',
  'российская': 'russia',
  'российское': 'russia',
  'рфпл': 'russia',
  'рпл': 'russia',
  'фнл': 'russia',
  'пфл': 'russia',
  'втб': 'russia',
  'единая лига': 'russia',
  'кубок россии': 'russia',
  'суперкубок россии': 'russia',
  'молодежное первенство': 'russia',
  
  // Англия
  'англия': 'england',
  'англии': 'england',
  'английский': 'england',
  'английская': 'england',
  'английское': 'england',
  'апл': 'england',
  'epl': 'england',
  'fa cup': 'england',
  'кубок лиги': 'england',
  'league cup': 'england',
  'carabao cup': 'england',
  'championship': 'england',
  'чемпионшип': 'england',
  
  // Испания
  'испания': 'spain',
  'испании': 'spain',
  'испанский': 'spain',
  'испанская': 'spain',
  'испанское': 'spain',
  'примера': 'spain',
  'ла лига': 'spain',
  'ла-лига': 'spain',
  'laliga': 'spain',
  'сегунда': 'spain',
  'copa del rey': 'spain',
  'кубок испании': 'spain',
  
  // Италия
  'италия': 'italy',
  'италии': 'italy',
  'итальянский': 'italy',
  'итальянская': 'italy',
  'итальянское': 'italy',
  'серия а': 'italy',
  'серия б': 'italy',
  'serie a': 'italy',
  'serie b': 'italy',
  'coppa italia': 'italy',
  'кубок италии': 'italy',
  'суперкубок италии': 'italy',
  
  // Германия
  'германия': 'germany',
  'германии': 'germany',
  'немецкий': 'germany',
  'немецкая': 'germany',
  'немецкое': 'germany',
  'бундеслига': 'germany',
  'бундеслига 2': 'germany',
  'bundesliga': 'germany',
  'dfb pokal': 'germany',
  'кубок германии': 'germany',
  'суперкубок германии': 'germany',
  
  // Франция
  'франция': 'france',
  'франции': 'france',
  'французский': 'france',
  'французская': 'france',
  'французское': 'france',
  'лига 1': 'france',
  'лига 2': 'france',
  'ligue 1': 'france',
  'ligue 2': 'france',
  'кубок франции': 'france',
  'coupe de france': 'france',
  'суперкубок франции': 'france',
  
  // Нидерланды
  'нидерланды': 'netherlands',
  'голландия': 'netherlands',
  'голландии': 'netherlands',
  'голландский': 'netherlands',
  'голландская': 'netherlands',
  'голландское': 'netherlands',
  'эредивизи': 'netherlands',
  'эредивизие': 'netherlands',
  'eredivisie': 'netherlands',
  'knvb cup': 'netherlands',
  'кубок голландии': 'netherlands',
  
  // Португалия
  'португалия': 'portugal',
  'португалии': 'portugal',
  'португальский': 'portugal',
  'португальская': 'portugal',
  'португальское': 'portugal',
  'примейра': 'portugal',
  'primeira': 'portugal',
  'liga nos': 'portugal',
  'taca de portugal': 'portugal',
  'кубок португалии': 'portugal',
  
  // Бразилия
  'бразилия': 'brazil',
  'бразилии': 'brazil',
  'бразильский': 'brazil',
  'бразильская': 'brazil',
  'бразильское': 'brazil',
  'серия а бразилия': 'brazil',
  'кубок бразилии': 'brazil',
  'brasileirao': 'brazil',
  'paulista': 'brazil',
  'кариока': 'brazil',
  'copa do brasil': 'brazil',
  
  // Аргентина
  'аргентина': 'argentina',
  'аргентины': 'argentina',
  'аргентинский': 'argentina',
  'аргентинская': 'argentina',
  'аргентинское': 'argentina',
  'примера аргентина': 'argentina',
  'суперлига аргентины': 'argentina',
  'копа аргентина': 'argentina',
  'copa argentina': 'argentina',
  
  // Украина
  'украина': 'ukraine',
  'украины': 'ukraine',
  'украинский': 'ukraine',
  'украинская': 'ukraine',
  'украинское': 'ukraine',
  'упл': 'ukraine',
  'премьер-лига украины': 'ukraine',
  'кубок украины': 'ukraine',
  'суперкубок украины': 'ukraine',
  
  // США
  'сша': 'usa',
  'америка': 'usa',
  'америки': 'usa',
  'американский': 'usa',
  'американская': 'usa',
  'американское': 'usa',
  'млс': 'usa',
  'mls': 'usa',
  'us open cup': 'usa',
  'кубок сша': 'usa',
  'ncaa': 'usa',
  
  // Китай
  'китай': 'china',
  'китая': 'china',
  'китайский': 'china',
  'китайская': 'china',
  'китайское': 'china',
  'суперлига китай': 'china',
  'chinese super league': 'china',
  'csl': 'china',
  'fa cup china': 'china',
  
  // Япония
  'япония': 'japan',
  'японии': 'japan',
  'японский': 'japan',
  'японская': 'japan',
  'японское': 'japan',
  'джей лига': 'japan',
  'j-лига': 'japan',
  'j1 league': 'japan',
  'j2 league': 'japan',
  'emperors cup': 'japan',
  
  // Корея
  'корея': 'korea',
  'кореи': 'korea',
  'корейский': 'korea',
  'корейская': 'korea',
  'корейское': 'korea',
  'к-лига': 'korea',
  'к лига': 'korea',
  'k league': 'korea',
  'korean fa cup': 'korea',
  
  // Турция
  'турция': 'turkey',
  'турции': 'turkey',
  'турецкий': 'turkey',
  'турецкая': 'turkey',
  'турецкое': 'turkey',
  'суперлига турция': 'turkey',
  'super lig': 'turkey',
  'турецкая суперлига': 'turkey',
  'кубок турции': 'turkey',
  
  // Австрия
  'австрия': 'austria',
  'австрии': 'austria',
  'австрийский': 'austria',
  'австрийская': 'austria',
  'австрийское': 'austria',
  'бундеслига австрия': 'austria',
  'austrian bundesliga': 'austria',
  'кубок австрии': 'austria',
  
  // Швейцария
  'швейцария': 'switzerland',
  'швейцарии': 'switzerland',
  'швейцарский': 'switzerland',
  'швейцарская': 'switzerland',
  'швейцарское': 'switzerland',
  'суперлига швейцария': 'switzerland',
  'swiss super league': 'switzerland',
  'challenge league': 'switzerland',
  
  // Бельгия
  'бельгия': 'belgium',
  'бельгии': 'belgium',
  'бельгийский': 'belgium',
  'бельгийская': 'belgium',
  'бельгийское': 'belgium',
  'про-лига': 'belgium',
  'жюпиле': 'belgium',
  'jupiler pro league': 'belgium',
  'belgian cup': 'belgium',
  
  // Шотландия
  'шотландия': 'scotland',
  'шотландии': 'scotland',
  'шотландский': 'scotland',
  'шотландская': 'scotland',
  'шотландское': 'scotland',
  'премьершип': 'scotland',
  'premiership': 'scotland',
  'scottish cup': 'scotland',
  
  // Польша
  'польша': 'poland',
  'польши': 'poland',
  'польский': 'poland',
  'польская': 'poland',
  'польское': 'poland',
  'экстракласа': 'poland',
  'ekstraklasa': 'poland',
  'polish cup': 'poland',
  
  // Чехия
  'чехия': 'czech',
  'чехии': 'czech',
  'чешский': 'czech',
  'чешская': 'czech',
  'чешское': 'czech',
  'фортуна лига': 'czech',
  'fortuna liga чехия': 'czech',
  'czech cup': 'czech',
  
  // Хорватия
  'хорватия': 'croatia',
  'хорватии': 'croatia',
  'хорватский': 'croatia',
  'хорватская': 'croatia',
  'хорватское': 'croatia',
  'hnl': 'croatia',
  'croatian cup': 'croatia',
  
  // Греция
  'греция': 'greece',
  'греции': 'greece',
  'греческий': 'greece',
  'греческая': 'greece',
  'греческое': 'greece',
  'суперлига греции': 'greece',
  'greek cup': 'greece',
  
  // Румыния
  'румыния': 'romania',
  'румынии': 'romania',
  'румынский': 'romania',
  'румынская': 'romania',
  'румынское': 'romania',
  'liga 1': 'romania',
  'romanian cup': 'romania',
  
  // Сербия
  'сербия': 'serbia',
  'сербии': 'serbia',
  'сербский': 'serbia',
  'сербская': 'serbia',
  'сербское': 'serbia',
  'суперлига сербии': 'serbia',
  'serbian cup': 'serbia',
  
  // Словакия
  'словакия': 'slovakia',
  'словакии': 'slovakia',
  'словацкий': 'slovakia',
  'словацкая': 'slovakia',
  'словацкое': 'slovakia',
  'фортуна лига словакия': 'slovakia',
  'fortuna liga slovakia': 'slovakia',
  'slovak cup': 'slovakia',
  
  // Словения
  'словения': 'slovenia',
  'словении': 'slovenia',
  'словенский': 'slovenia',
  'словенская': 'slovenia',
  'словенское': 'slovenia',
  'prva liga': 'slovenia',
  'slovenian cup': 'slovenia',
  
  // Венгрия
  'венгрия': 'hungary',
  'венгрии': 'hungary',
  'венгерский': 'hungary',
  'венгерская': 'hungary',
  'венгерское': 'hungary',
  'nb i': 'hungary',
  'hungarian cup': 'hungary',
  
  // Болгария
  'болгария': 'bulgaria',
  'болгарии': 'bulgaria',
  'болгарский': 'bulgaria',
  'болгарская': 'bulgaria',
  'болгарское': 'bulgaria',
  'първа лига': 'bulgaria',
  'bulgarian cup': 'bulgaria',
  
  // Израиль
  'израиль': 'israel',
  'израиля': 'israel',
  'израильский': 'israel',
  'израильская': 'israel',
  'израильское': 'israel',
  'ligat ha`al': 'israel',
  'israeli cup': 'israel',
  
  // Казахстан
  'казахстан': 'kazakhstan',
  'казахстана': 'kazakhstan',
  'казахстанский': 'kazakhstan',
  'казахстанская': 'kazakhstan',
  'казахстанское': 'kazakhstan',
  'премьер-лига казахстана': 'kazakhstan',
  'kazakhstan cup': 'kazakhstan',
  
  // Беларусь
  'беларусь': 'belarus',
  'белоруссия': 'belarus',
  'белоруссии': 'belarus',
  'белорусский': 'belarus',
  'белорусская': 'belarus',
  'белорусское': 'belarus',
  'высшая лига беларусь': 'belarus',
  'кубок беларуси': 'belarus',
  
  // Азербайджан
  'азербайджан': 'azerbaijan',
  'азербайджана': 'azerbaijan',
  'азербайджанский': 'azerbaijan',
  'азербайджанская': 'azerbaijan',
  'азербайджанское': 'azerbaijan',
  'премьер-лига азербайджана': 'azerbaijan',
  'azerbaijan cup': 'azerbaijan',
  
  // Армения
  'армения': 'armenia',
  'армении': 'armenia',
  'армянский': 'armenia',
  'армянская': 'armenia',
  'армянское': 'armenia',
  'премьер-лига армении': 'armenia',
  'armenian cup': 'armenia',
  
  // Грузия
  'грузия': 'georgia',
  'грузии': 'georgia',
  'грузинский': 'georgia',
  'грузинская': 'georgia',
  'грузинское': 'georgia',
  'эровнули лига': 'georgia',
  'georgian cup': 'georgia',
  
  // Узбекистан
  'узбекистан': 'uzbekistan',
  'узбекистана': 'uzbekistan',
  'узбекский': 'uzbekistan',
  'узбекская': 'uzbekistan',
  'узбекское': 'uzbekistan',
  'суперлига узбекистана': 'uzbekistan',
  'uzbekistan cup': 'uzbekistan',
  
  // Молдова
  'молдова': 'moldova',
  'молдовы': 'moldova',
  'молдавский': 'moldova',
  'молдавская': 'moldova',
  'молдавское': 'moldova',
  'национальный дивизион': 'moldova',
  'moldovan cup': 'moldova'
};

export function determineCountryFromLeagueName(
  sport: string,
  leagueName: string,
): string {
  if (!leagueName || typeof leagueName !== 'string') return 'other';

  const lowerLeagueName = leagueName.toLowerCase();

  // 1. Проверка на специальные турниры и лиги по видам спорта
  if (sport === 'hockey') {
    if (lowerLeagueName.includes('nhl')) return 'nhl';
    if (lowerLeagueName.includes('кхл') || lowerLeagueName.includes('khl')) return 'khl';
    if (lowerLeagueName.includes('вхл')) return 'russia';
    if (lowerLeagueName.includes('мхл')) return 'russia';
    if (lowerLeagueName.includes('shl')) return 'sweden';
    if (lowerLeagueName.includes('liiga')) return 'finland';
    if (lowerLeagueName.includes('del')) return 'germany';
    if (lowerLeagueName.includes('extraliga')) return 'czech';
  }

  if (sport === 'basketball') {
    if (lowerLeagueName.includes('nba')) return 'nba';
    if (lowerLeagueName.includes('единая лига втб')) return 'russia';
    if (lowerLeagueName.includes('евролига') || lowerLeagueName.includes('euroleague')) return 'euroleague';
    if (lowerLeagueName.includes('еврокубок') || lowerLeagueName.includes('eurocup')) return 'eurocup';
    if (lowerLeagueName.includes('acb')) return 'spain';
    if (lowerLeagueName.includes('лига вэф')) return 'latvia';
    if (lowerLeagueName.includes('bbl')) return 'baltic';
    if (lowerLeagueName.includes('ncaa')) return 'usa';
  }

  if (sport === 'tennis') {
    if (lowerLeagueName.includes('atp')) return 'atp';
    if (lowerLeagueName.includes('wta')) return 'wta';
    if (lowerLeagueName.includes('itf')) return 'itf';
    if (lowerLeagueName.includes('davis cup')) return 'davis-cup';
    if (lowerLeagueName.includes('fed cup')) return 'fed-cup';
    if (
      lowerLeagueName.includes('australian open') ||
      lowerLeagueName.includes('roland garros') ||
      lowerLeagueName.includes('wimbledon') ||
      lowerLeagueName.includes('us open')
    ) {
      return 'grand-slam';
    }
  }

  if (sport === 'volleyball') {
    if (lowerLeagueName.includes('суперлига')) return 'russia';
    if (lowerLeagueName.includes('лига чемпионов') || lowerLeagueName.includes('champions league')) return 'champions';
    if (lowerLeagueName.includes('кубок екв') || lowerLeagueName.includes('cev cup')) return 'cev';
    if (lowerLeagueName.includes('мировая лига') || lowerLeagueName.includes('world league')) return 'world-league';
  }

  if (sport === 'table-tennis') {
    if (lowerLeagueName.includes('лига про')) return 'russia';
    if (lowerLeagueName.includes('ittf')) return 'ittf';
    if (lowerLeagueName.includes('wtt')) return 'wtt';
    if (lowerLeagueName.includes('challenger')) return 'challenger';
  }

  if (sport === 'baseball') {
    if (lowerLeagueName.includes('mlb')) return 'mlb';
    if (lowerLeagueName.includes('npb')) return 'japan';
    if (lowerLeagueName.includes('kbo')) return 'korea';
    if (lowerLeagueName.includes('cpbl')) return 'china';
  }

  if (sport === 'esports.cs') {
    if (lowerLeagueName.includes('major')) return 'major';
    if (lowerLeagueName.includes('esl')) return 'esl';
    if (lowerLeagueName.includes('blast')) return 'blast';
    if (lowerLeagueName.includes('rio')) return 'major';
    if (lowerLeagueName.includes('paris')) return 'major';
    if (lowerLeagueName.includes('weplay')) return 'weplay';
    if (lowerLeagueName.includes('pinnacle')) return 'pinnacle';
  }

  if (sport === 'esports.dota2') {
    if (lowerLeagueName.includes('international')) return 'ti';
    if (lowerLeagueName.includes('major')) return 'major';
    if (lowerLeagueName.includes('dreamleague')) return 'dreamleague';
    if (lowerLeagueName.includes('esl')) return 'esl';
    if (lowerLeagueName.includes('bts')) return 'bts';
    if (lowerLeagueName.includes('one esports')) return 'one';
  }

  // 2. Проверка на международные турниры
  const internationalTournaments = [
    'лига чемпионов', 'champions league',
    'лига европы', 'europa league',
    'кубок либертадорес', 'libertadores',
    'лига конференций', 'conference league',
    'world cup', 'чемпионат мира',
    'euro', 'евро', 'чемпионат европы',
    'uefa', 'уефа',
    'fifa', 'фифа',
    'международный', 'international',
    'копа америка', 'copa america',
    'кубок африки', 'africa cup',
    'лига наций', 'nations league',
    'олимпийские игры', 'olympic',
    'world championship', 'чемпионат мира',
    'european championship', 'чемпионат европы',
    'continental cup', 'континентальный кубок',
    'world tour', 'мировой тур',
    'world series', 'мировая серия',
    'world grand prix', 'мировой гран-при'
  ];

  for (const tournament of internationalTournaments) {
    if (lowerLeagueName.includes(tournament)) {
      return 'international';
    }
  }

  // 3. Проверка на формат "Чемпионат/Кубок/Суперкубок/Лига страны"
  const prefixes = [
    'чемпионат', 'кубок', 'суперкубок', 'лига', 'первенство', 
    'высшая лига', 'премьер-лига', 'суперлига', 'про-лига',
    'championship', 'cup', 'supercup', 'league', 'premier'
  ];

  for (const prefix of prefixes) {
    if (lowerLeagueName.startsWith(prefix + ' ')) {
      const restOfName = lowerLeagueName.substring(prefix.length + 1);
      for (const [russianName, code] of Object.entries(russianCountryMap)) {
        if (restOfName.startsWith(russianName)) {
          return code;
        }
      }
    }
  }

  // 4. Проверка на прямое упоминание страны в названии
  for (const [russianName, code] of Object.entries(russianCountryMap)) {
    // Проверяем как отдельное слово с границами
    const regex = new RegExp(`(^|\\s|\\.|,|\\()${russianName}(\\s|$|\\.|,|\\))`, 'i');
    if (regex.test(lowerLeagueName)) {
      return code;
    }
  }

  // 5. Проверка на известные лиги и их сокращения
  const leagueMap = {
    'премьер-лига': 'england',
    'premier league': 'england',
    'epl': 'england',
    'бундеслига': 'germany',
    'bundesliga': 'germany',
    'серия а': 'italy',
    'serie a': 'italy',
    'ла лига': 'spain',
    'la liga': 'spain',
    'лига 1': 'france',
    'ligue 1': 'france',
    'эредивизи': 'netherlands',
    'eredivisie': 'netherlands',
    'примейра': 'portugal',
    'primeira': 'portugal',
    'суперлига турции': 'turkey',
    'super lig': 'turkey',
    'allsvenskan': 'sweden',
    'экстракласа': 'poland',
    'ekstraklasa': 'poland',
    'суперлига швейцарии': 'switzerland',
    'super league': 'switzerland',
    'высшая лига': 'russia',
    'рпл': 'russia',
    'рфпл': 'russia',
    'фнл': 'russia',
    'пфл': 'russia',
    'млс': 'usa',
    'mls': 'usa',
    'csl': 'china',
    'j-league': 'japan',
    'k-league': 'korea',
    'a-league': 'australia'
  };

  for (const [leagueName, code] of Object.entries(leagueMap)) {
    if (lowerLeagueName.includes(leagueName)) {
      return code;
    }
  }

  // 6. Если это товарищеский матч или выставочный
  if (
    lowerLeagueName.includes('товарищеский') ||
    lowerLeagueName.includes('friendly') ||
    lowerLeagueName.includes('exhibition')
  ) {
    return 'friendly';
  }

  // 7. Если не удалось определить страну, возвращаем 'other'
  return 'other';
}
