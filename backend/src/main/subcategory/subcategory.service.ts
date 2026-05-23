import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subcategory } from '@prisma/client';
import { LRUCache } from 'lru-cache';

import { PrismaService } from '../../prisma/prisma.service';
import { countriesData } from '../../data/countries';

interface CreateSubcategoryDto {
  code: string;
  name: string;
  sport: string;
  type?: string;
  isPriority?: boolean;
  flag?: string;
}

interface UpdateSubcategoryDto {
  isActive?: boolean;
  name?: string;
  type?: string;
  isPriority?: boolean;
}

@Injectable()
export class SubcategoryService implements OnModuleInit {
  private logger = new Logger(SubcategoryService.name);
  
  // LRU кэш для подкатегорий (ключ: "code:sport", значение: Subcategory)
  private subcategoryCache = new LRUCache<string, Subcategory>({
    max: 1000, // Максимум 1000 записей в кэше
    ttl: 1000 * 60 * 30, // TTL 30 минут
  });

  private russianCountryMap: Record<string, string> = {
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

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Генерация ключа кэша для подкатегории
   */
  private getCacheKey(code: string, sport: string): string {
    return `${code}:${sport}`;
  }

  /**
   * Получение подкатегории из кэша
   */
  private getFromCache(code: string, sport: string): Subcategory | undefined {
    return this.subcategoryCache.get(this.getCacheKey(code, sport));
  }

  /**
   * Сохранение подкатегории в кэш
   */
  private setToCache(subcategory: Subcategory): void {
    this.subcategoryCache.set(this.getCacheKey(subcategory.code, subcategory.sport), subcategory);
  }

  /**
   * Удаление подкатегории из кэша
   */
  private deleteFromCache(code: string, sport: string): void {
    this.subcategoryCache.delete(this.getCacheKey(code, sport));
  }

  /**
   * Очистка всего кэша
   */
  private clearCache(): void {
    this.subcategoryCache.clear();
  }

  /**
   * Получение человекочитаемого имени подкатегории по коду
   */
  private getDisplayNameByCode(code: string): string {
    const displayNames: Record<string, string> = {
      'albania': 'Албания',
      'algeria': 'Алжир',
      'argentina': 'Аргентина',
      'armenia': 'Армения',
      'australia': 'Австралия',
      'austria': 'Австрия',
      'azerbaijan': 'Азербайджан',
      atp: 'ATP',
      'belarus': 'Беларусь',
      'belgium': 'Бельгия',
      'bellator': 'Bellator',
      blast: 'BLAST',
      'bolivia': 'Боливия',
      'bosnia': 'Босния и Герцеговина',
      'brazil': 'Бразилия',
      'bulgaria': 'Болгария',
      'bundesliga': 'Бундеслига',
      'cameroon': 'Камерун',
      'canada': 'Канада',
      champions: 'Лига Чемпионов',
      championship: 'Чемпионат',
      'chile': 'Чили',
      'china': 'Китай',
      'colombia': 'Колумбия',
      'concacaf': 'CONCACAF',
      'copa-america': 'Кубок Америки',
      'croatia': 'Хорватия',
      cup: 'Кубок',
      'cyber-league': 'Cyber League',
      'czech': 'Чехия',
      'denmark': 'Дания',
      dreamhack: 'DreamHack',
      dreamleague: 'DreamLeague',
      'ecuador': 'Эквадор',
      'egypt': 'Египет',
      england: 'Англия',
      esl: 'ESL',
      'estonia': 'Эстония',
      'eurocup': 'Еврокубок',
      euroleague: 'Евролига',
      'european-championship': 'Чемпионат Европы',
      europa: 'Лига Европы',
      'exhibition': 'Выставочные матчи',
      'fiba': 'ФИБА',
      'fifa': 'ФИФА',
      'finland': 'Финляндия',
      'first-division': 'Первый дивизион',
      france: 'Франция',
      'friendly': 'Товарищеские матчи',
      germany: 'Германия',
      'georgia': 'Грузия',
      'ghana': 'Гана',
      'grand-slam': 'Большой шлем',
      'greece': 'Греция',
      'hungary': 'Венгрия',
      'ibf': 'IBF',
      'iceland': 'Исландия',
      'iem': 'IEM',
      'india': 'Индия',
      'indonesia': 'Индонезия',
      international: 'Международные',
      'iran': 'Иран',
      'iraq': 'Ирак',
      'ireland': 'Ирландия',
      'israel': 'Израиль',
      italy: 'Италия',
      'itf': 'ITF',
      'ittf': 'ITTF',
      'ivory-coast': 'Кот-д\'Ивуар',
      japan: 'Япония',
      'jordan': 'Иордания',
      'kazakhstan': 'Казахстан',
      khl: 'КХЛ',
      'kbo': 'KBO',
      korea: 'Корея',
      'la-liga': 'Ла Лига',
      'latvia': 'Латвия',
      'league-cup': 'Кубок Лиги',
      'lebanon': 'Ливан',
      'ligue-1': 'Лига 1',
      'liiga': 'Лиига',
      'lithuania': 'Литва',
      'luxembourg': 'Люксембург',
      'malaysia': 'Малайзия',
      major: 'Мейджор',
      'malta': 'Мальта',
      'mexico': 'Мексика',
      'mlb': 'MLB',
      'moldova': 'Молдова',
      'montenegro': 'Черногория',
      'morocco': 'Марокко',
      'nations-league': 'Лига Наций',
      nba: 'NBA',
      'ncaa': 'NCAA',
      'netherlands': 'Нидерланды',
      'new-zealand': 'Новая Зеландия',
      nhl: 'NHL',
      'nigeria': 'Нигерия',
      'norway': 'Норвегия',
      'npb': 'NPB',
      'one': 'ONE Championship',
      other: 'Мир',
      'paraguay': 'Парагвай',
      'peru': 'Перу',
      'philippines': 'Филиппины',
      'poland': 'Польша',
      portugal: 'Португалия',
      'premier': 'Премьер-лига',
      'premier-league': 'Премьер-лига',
      'qatar': 'Катар',
      'romania': 'Румыния',
      russia: 'Россия',
      'saudi-arabia': 'Саудовская Аравия',
      'scotland': 'Шотландия',
      'second-division': 'Второй дивизион',
      'senegal': 'Сенегал',
      'serbia': 'Сербия',
      'serie-a': 'Серия А',
      'shl': 'SHL',
      'short-football': 'Short Football',
      'singapore': 'Сингапур',
      'slovenia': 'Словения',
      'south-africa': 'ЮАР',
      spain: 'Испания',
      super: 'Суперлига',
      'super-league': 'SuperLeague',
      supercup: 'Суперкубок',
      'sweden': 'Швеция',
      'switzerland': 'Швейцария',
      'syria': 'Сирия',
      'thailand': 'Таиланд',
      ti: 'The International',
      'turkey': 'Турция',
      'uae': 'ОАЭ',
      'uefa': 'УЕФА',
      'ufc': 'UFC',
      'ukraine': 'Украина',
      'uruguay': 'Уругвай',
      usa: 'США',
      'uzbekistan': 'Узбекистан',
      'venezuela': 'Венесуэла',
      'vietnam': 'Вьетнам',
      'wales': 'Уэльс',
      'wba': 'WBA',
      'wbc': 'WBC',
      'wbo': 'WBO',
      'world-championship': 'Чемпионат мира',
      wta: 'WTA',
      'wtt': 'WTT',
    };

    return displayNames[code] || code.charAt(0).toUpperCase() + code.slice(1).replace(/-/g, ' ');
  }

  /**
   * Создание новой подкатегории
   */
  async create(data: CreateSubcategoryDto): Promise<Subcategory> {
    try {
      this.logger.log(`Creating subcategory: ${JSON.stringify(data)}`);
      
      // First check if subcategory already exists for this sport and code
      const existing = await this.findByCodeAndSport(data.code, data.sport);
      if (existing) {
        this.logger.debug(`Subcategory ${data.code} already exists for ${data.sport}, returning existing`);
        return existing;
      }

      // Set default values
      if (data.flag) {
        if (!data.flag.startsWith('/flags/')) {
          data.flag = `/flags/${data.flag}`;
        }
      } else {
        data.flag = `/flags/${data.code}.webp`;
      }

      // Set type if not provided
      if (!data.type) {
        if (['all', 'other', 'international', 'championship'].includes(data.code)) {
          data.type = data.code;
        } else {
          data.type = 'country';
        }
      }

      const subcategory = await this.prismaService.subcategory.create({
        data: {
          ...data,
          isPriority: false,
        },
      });
      this.logger.log(`Successfully created subcategory: ${JSON.stringify(subcategory)}`);
      return subcategory;
    } catch (error) {
      // Handle unique constraint violations gracefully
      if (error.code === 'P2002') {
        this.logger.debug(`Unique constraint violation for subcategory ${data.code}/${data.sport}, attempting to find existing`);
        const existing = await this.findByCodeAndSport(data.code, data.sport);
        if (existing) {
          return existing;
        }
      }
      this.logger.error(`Error creating subcategory: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Удаление подкатегории по ID
   */
  async delete(id: number): Promise<Subcategory> {
    return this.prismaService.subcategory.update({
      data: {
        isActive: false,
      },
      where: {
        id,
      },
    });
  }

  /**
   * Определение подкатегории по названию лиги
   */
  determineSubcategoryFromLeagueName(
    sport: string,
    leagueName: string,
  ): string {
    if (!leagueName || typeof leagueName !== 'string') return 'other';

    const lowerLeagueName = leagueName.toLowerCase();

    // 1. Проверка на специальные турниры и лиги
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
        for (const [russianName, code] of Object.entries(this.russianCountryMap)) {
          if (restOfName.startsWith(russianName)) {
            return code;
          }
        }
      }
    }

    // 4. Проверка на прямое упоминание страны в названии
    for (const [russianName, code] of Object.entries(this.russianCountryMap)) {
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

  /**
   * Получение всех подкатегорий
   */
  async findAll(onlyActive = true): Promise<Subcategory[]> {
    return this.prismaService.subcategory.findMany({
      where: {
        isActive: onlyActive ? true : undefined,
      },
    });
  }

  /**
   * Поиск подкатегории по коду и спорту с кэшированием
   */
  async findByCodeAndSport(code: string, sport: string): Promise<Subcategory | null> {
    // this.logger.log(`Searching for subcategory: ${sport}/${code}`);
    
    // Проверяем кэш
    const cached = this.getFromCache(code, sport);
    if (cached) {
      return cached;
    }

    try {
      const subcategory = await this.prismaService.subcategory.findFirst({
        where: {
          code,
          sport,
        },
      });
      
      // Кэшируем результат (только если найден)
      if (subcategory) {
        this.setToCache(subcategory);
      }
      
      // this.logger.log(`Found subcategory: ${subcategory ? `${subcategory.name} (${subcategory.code})` : 'null'}`);
      return subcategory;
    } catch (error) {
      this.logger.error(`Error searching for subcategory ${sport}/${code}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Поиск подкатегории по ID
   */
  async findById(id: number): Promise<Subcategory | null> {
    return this.prismaService.subcategory.findUnique({
      where: { id },
    });
  }

  /**
   * Получение всех подкатегорий для указанного спорта
   */
  async findBySport(sport: string, onlyActive = false): Promise<Subcategory[]> {
    // this.logger.log(`Searching for subcategories by sport: ${sport}, onlyActive: ${onlyActive}`);
    try {
      const subcategories = await this.prismaService.subcategory.findMany({
        where: {
          sport,
          isActive: onlyActive ? true : undefined,
        },
        orderBy: [
          { isPriority: 'desc' },
          { name: 'asc' }
        ]
      });
      // this.logger.log(`Found ${subcategories.length} subcategories for sport ${sport}`);
      return subcategories;
    } catch (error) {
      this.logger.error(`Error searching for subcategories by sport ${sport}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Найти или создать подкатегорию с инвалидацией кэша
   */
  async findOrCreate(
    code: string,
    sport: string,
    flag?: string,
    name?: string,
  ): Promise<Subcategory> {
    try {
      const displayName = name || this.getDisplayNameByCode(code);
      const countryData = countriesData.find(c => c.code === code);
      
      const subcategoryFlag = flag || countryData?.flag || '/flags/other.webp';

      // Используем upsert для атомарной операции find-or-create
      const result = await this.prismaService.subcategory.upsert({
        where: {
          code_sport: {
            code,
            sport,
          },
        },
        update: {
          // При обновлении можем обновить флаг и имя, если они переданы
          ...(flag && { flag: subcategoryFlag }),
          ...(name && { name: displayName }),
        },
        create: {
          code,
          name: displayName,
          sport,
          type: countryData ? 'country' : 'other',
          flag: subcategoryFlag,
          isPriority: false,
        },
      });

      // Обновляем кэш с новым/обновленным результатом
      this.setToCache(result);
      
      return result;
    } catch (error: any) {
      this.logger.error(`Error in findOrCreate for subcategory ${code}/${sport}: ${error.message}`);
      
      // Fallback: попытка найти существующую запись
      const existing = await this.prismaService.subcategory.findFirst({
        where: {
          code,
          sport,
        },
      });

      if (existing) {
        // Кэшируем найденную запись
        this.setToCache(existing);
        return existing;
      }

      throw new Error(`Unable to create or find subcategory ${code}/${sport}: ${error.message}`);
    }
  }

  /**
   * Обновление подкатегории по ID
   */
  async update(id: number, data: UpdateSubcategoryDto): Promise<Subcategory> {
    return this.prismaService.subcategory.update({
      data,
      where: {
        id,
      },
    });
  }

  /**
   * Обновление подкатегорий для всех игр
   */
  async updateAllGamesWithSubcategories(
    limit: number = 100,
  ): Promise<{ processed: number; updated: number }> {
    const games = await this.prismaService.game.findMany({
      take: limit,
      where: {
        leagueName: { not: '' },
        subcategoryId: null,
      },
    });

    if (!games.length) {
      return { processed: 0, updated: 0 };
    }

    let updated = 0;

    for (const game of games) {
      const { leagueName, sport } = game;
      if (!sport || !leagueName) continue;

      try {
        // Определяем подкатегорию по названию лиги
        const subcategoryCode = this.determineSubcategoryFromLeagueName(
          sport,
          leagueName,
        );

        // Находим или создаем подкатегорию
        const subcategory = await this.findOrCreate(subcategoryCode, sport);

        // Обновляем игру с subcategoryId
        await this.prismaService.game.update({
          data: { subcategoryId: subcategory.id },
          where: { eventId: game.eventId },
        });

        updated++;
      } catch (error) {
        this.logger.error(
          `Error updating subcategory for game ${game.eventId}:`,
          error,
        );
      }
    }

    return { processed: games.length, updated };
  }

  /**
   * Автоматическое создание базовых подкатегорий при запуске приложения
   */
  async onModuleInit() {
    // this.logger.log('Initializing default subcategories...');
    
    try {
      // Check existing subcategories
      const existingSubcategories = await this.prismaService.subcategory.findMany();
      // this.logger.log(`Found ${existingSubcategories.length} existing subcategories`);
      
      if (existingSubcategories.length > 0) {
        // this.logger.log('Subcategories already exist, skipping initialization');
        return;
      }

      // Define main sports
      const mainSports = [
        'soccer', 'basketball', 'hockey', 'tennis', 
        'volleyball', 'table-tennis', 'baseball', 'esports.cs', 
        'esports.dota2',
      ];
      
      // Load country codes
      // this.logger.log('Loading country codes...');
      const countryCodes = countriesData;
      // this.logger.log(`Loaded ${countryCodes.length} country codes`);
      
      let createdCount = 0;
      let errorCount = 0;

      // Process each sport
      for (const sport of mainSports) {
        // this.logger.log(`Processing sport: ${sport}`);
        
        // Create 'all' subcategory
        try {
          await this.create({
            code: 'all',
            name: 'Все',
            sport,
            type: 'all',
            isPriority: false,
          });
          createdCount++;
          // this.logger.log(`Created 'all' subcategory for ${sport}`);
        } catch (error) {
          this.logger.error(`Error creating 'all' subcategory for ${sport}: ${error.message}`);
          errorCount++;
        }

        // Create 'other' subcategory
        try {
          await this.create({
            code: 'other',
            name: 'Мир',
            sport,
            type: 'other',
            isPriority: false,
          });
          createdCount++;
          // this.logger.log(`Created 'other' subcategory for ${sport}`);
        } catch (error) {
          this.logger.error(`Error creating 'other' subcategory for ${sport}: ${error.message}`);
          errorCount++;
        }

        // Create country-specific subcategories
        for (const country of countryCodes) {
          try {
            await this.create({
              code: country.code,
              name: country.name,
              sport,
              type: 'country',
              isPriority: false,
              flag: country.flag,
            });
            createdCount++;
            // this.logger.log(`Created country subcategory: ${sport}/${country.code}`);
          } catch (error) {
            this.logger.error(`Error creating country subcategory ${country.code} for ${sport}: ${error.message}`);
            errorCount++;
          }
        }
      }

      // this.logger.log(`Subcategory initialization complete. Created: ${createdCount}, Errors: ${errorCount}`);

      // Verify final count
      const finalCount = await this.prismaService.subcategory.count();
      // this.logger.log(`Final subcategory count in database: ${finalCount}`);

    } catch (error) {
      this.logger.error('Error during subcategory initialization:', error);
      throw error;
    }
  }
  
  /**
   * Настраивает регулярное обновление subcategoryId для новых игр
   */
  private async setupRecurringSubcategoryUpdates() {
    // Сначала запускаем немедленное обновление при старте сервера
    try {
      // Подсчитаем сколько игр без subcategoryId
      const gamesWithoutSubcategory = await this.prismaService.game.count({
        where: { subcategoryId: null }
      });
      
      if (gamesWithoutSubcategory > 0) {
        this.logger.log(`Found ${gamesWithoutSubcategory} games without subcategoryId - updating`);
        const result = await this.updateMissingGameSubcategories(undefined, 100);
        this.logger.log(`Updated subcategories for ${result.updated} of ${result.processed} processed games`);
      } else {
        this.logger.log('No games with missing subcategoryId found');
      }
      
      // Настраиваем регулярное обновление каждые 15 минут (увеличили с 5 до 15)
      setInterval(async () => {
        try {
          // Подсчитаем сколько игр без subcategoryId
          const gamesWithoutSubcategory = await this.prismaService.game.count({
            where: { subcategoryId: null }
          });
          
          if (gamesWithoutSubcategory > 0) {
            this.logger.log(`Found ${gamesWithoutSubcategory} games without subcategoryId - updating`);
            const result = await this.updateMissingGameSubcategories(undefined, 50);
            this.logger.log(`Updated subcategories for ${result.updated} of ${result.processed} processed games`);
          }
        } catch (error) {
          this.logger.error('Error in recurring subcategory update:', error);
        }
      }, 15 * 60 * 1000); // Увеличили с 5 до 15 минут
      
      this.logger.log('Recurring subcategory update job set up successfully (every 15 minutes)');
    } catch (error) {
      this.logger.error('Error setting up recurring subcategory updates:', error);
    }
  }

  /**
   * Обновить игры с отсутствующими ID подкатегорий
   * Метод для исправления ситуации, когда у некоторых игр отсутствует subcategoryId
   */
  async updateMissingGameSubcategories(
    sport?: string,
    limit: number = 50, // Уменьшили лимит с 100 до 50
  ): Promise<{ processed: number; updated: number }> {
    try {
      // Найдем игры без subcategoryId
      const whereCondition: any = {
        subcategoryId: null,
      };
      
      if (sport) {
        whereCondition.sport = sport;
      }
      
      // Сначала посчитаем, сколько всего таких игр
      const totalGamesWithoutSubcategory = await this.prismaService.game.count({
        where: whereCondition,
      });
      
      if (totalGamesWithoutSubcategory === 0) {
        return { processed: 0, updated: 0 };
      }
      
      // Получим игры без subcategoryId с меньшим лимитом
      const games = await this.prismaService.game.findMany({
        where: whereCondition,
        take: limit,
        select: {
          eventId: true,
          sport: true,
          leagueName: true,
        },
        orderBy: {
          createdAt: 'desc' // Обрабатываем новые игры сначала
        }
      });
      
      // Также найдем игры с Championship категорией, которые могут содержать название страны
      const championshipSubcategories = await this.prismaService.subcategory.findMany({
        where: {
          code: 'championship'
        }
      });
      
      const championshipIds = championshipSubcategories.map(sub => sub.id);
      
      const gamesWithChampionship = await this.prismaService.game.findMany({
        where: {
          subcategoryId: { in: championshipIds },
          leagueName: {
            contains: 'Чемпионат',
            mode: 'insensitive'
          }
        },
        take: Math.floor(limit / 2), // Уменьшили лимит
        select: {
          eventId: true,
          sport: true,
          leagueName: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      const allGamesToProcess = [...games, ...gamesWithChampionship];
      
      let updatedCount = 0;
      
      // Обрабатываем каждую игру с задержкой для снижения нагрузки
      for (const game of allGamesToProcess) {
        try {
          // Определяем подкатегорию для игры
          const subcategoryCode = this.determineSubcategoryFromLeagueName(
            game.sport,
            game.leagueName,
          );
          
          // Находим ID подкатегории по коду
          const subcategory = await this.findOrCreate(
            subcategoryCode,
            game.sport,
          );
          
          // Обновляем игру с ID подкатегории
          await this.prismaService.game.update({
            where: { eventId: game.eventId },
            data: { subcategoryId: subcategory.id },
          });
          
          updatedCount++;
          
          // Добавляем небольшую задержку между обновлениями
          if (updatedCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          this.logger.error(`Error updating subcategory for game ${game.eventId}: ${error.message}`);
          // Продолжаем обработку других игр
        }
      }
      
      return {
        processed: allGamesToProcess.length,
        updated: updatedCount,
      };
    } catch (error) {
      this.logger.error(`Error updating missing subcategory IDs: ${error.message}`);
      return { processed: 0, updated: 0 };
    }
  }

  /**
   * Обновление приоритетов подкатегорий
   */
  async updatePriorities(updates: { id: number; isPriority: boolean }[]) {
    try {
      const normalized = updates.map((update) => {
        const id = Number(update.id);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error(`Invalid subcategory id: ${update.id}`);
        }
        return { id, isPriority: Boolean(update.isPriority) };
      });

      const subcategoryIds = normalized.map((update) => update.id);
      const existingSubcategories = await this.prismaService.subcategory.findMany({
        where: { id: { in: subcategoryIds } },
      });

      if (existingSubcategories.length !== normalized.length) {
        const foundIds = existingSubcategories.map((sc) => sc.id);
        const missingIds = subcategoryIds.filter((id) => !foundIds.includes(id));
        this.logger.error(`Some subcategories not found: ${missingIds.join(', ')}`);
        throw new Error(`Some subcategories not found: ${missingIds.join(', ')}`);
      }

      await this.prismaService.$transaction(
        normalized.map((update) =>
          this.prismaService.subcategory.update({
            where: { id: update.id },
            data: { isPriority: update.isPriority },
          }),
        ),
      );

      return { success: true };
    } catch (error) {
      this.logger.error('Error updating subcategory priorities:', error);
      throw error;
    }
  }
}