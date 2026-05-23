import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Logger } from 'winston';

import { ParsedBet, ParsedScoreDto } from '~/main/game/dto/available-games.dto';

const R = String.raw;
const s = R`\d+:\d+`;
const cS = R`(?<currentScore>${s})`;
const dt = R`( \((?<details>(${s} ?)+)\))?`;
const dtWithLive = R`( \((?<details>(${s} ?)*(?<liveScore>\d+[*]?:\d+[*]?))\))?`;
const time = R`( (?<time>\d{1,3}:\d{2}))?`;
const game = R`[A\d]+[*]?`;
const live = R`( \((?<liveScore>${game}:${game})\))?`;
const parsers = {
  basketball: new RegExp(`^${cS}${dt}${time}$`),
  'esports.cs': new RegExp(`^${cS}${dtWithLive}$`),
  'esports.dota2': new RegExp(`^${cS}${dt}${time}$`),
  'esports.lol': new RegExp(`^${cS}${dt}${time}$`),
  hockey: new RegExp(`^${cS}${dt}${time}$`),
  soccer: new RegExp(`^${cS}${dt}${time}$`),
  'table-tennis': new RegExp(`^${cS}${dtWithLive}$`),
  tennis: new RegExp(`^${cS}${dt}${live}$`),
  volleyball: new RegExp(`^${cS}${dtWithLive}$`),
};

@Injectable()
export class BetParser implements OnModuleInit {
  private parsers?: Array<readonly [string, RegExp]>;
  constructor(
    @Inject('winston') private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {}

  private async getBetParsers() {
    const { data: betTypes } = await axios<Record<string, string | string[]>>(
      'http://api.oddscp.com:8111/dynamic_js/bet_types.js',
    );

    this.parsers = Object.entries(betTypes).flatMap(([betType, parser]) => {
      const parsers = Array.isArray(parser) ? parser : [parser];
      return parsers
        .map((e) => new RegExp(e.slice(1, -1)))
        .map((e) => [betType, e] as const);
    });
  }

  private parseDetails(details?: string) {
    if (!details) return [];
    return details
      .trim()
      .replace('*', '')
      .split(' ')
      .map((e) => e.split(':').map(Number)) as Array<[number, number]>;
  }

  private parseLiveScore(liveScore?: string) {
    if (!liveScore) return;
    const active = (liveScore
      .split('')
      .filter((e) => e === '*' || e === ':')
      .indexOf('*') + 1) as 0 | 1 | 2;

    const score = liveScore.replace('*', '').split(':').map(Number);
    return {
      active,
      score: score as [number, number],
    };
  }

  private parseTimeToSeconds(time?: string) {
    if (!time) return;
    if (time.includes(':')) {
      const [minutes, seconds] = time.split(':').map(Number);
      return minutes * 60 + seconds;
    }
  }

  async onModuleInit() {
    // const enabled = this.configService.get('ODDSCP_ENABLED', false);
    // if ( enabled === 'true' || enabled === true ) {
    await this.getBetParsers();
    // }
  }

  parse(bet: string) {
    // Логирование для отладки
    // console.log('==== PARSE BET ====');
    // console.log('Bet string:', bet);
    
    // Проверяем, есть ли парсер для этой ставки
    const parser = this.parsers.find(([, matcher]) => matcher.test(bet));
    
    if (!parser) {
      // console.log('No parser found for bet:', bet);
      // Возвращаем пустой объект с базовым полем basis
      return { basis: 'UNKNOWN_OTHER' };
    }
    
    const [, matcher] = parser;
    const match = bet.match(matcher);
    
    if (!match || !match.groups) {
      // console.log('No match found for bet:', bet);
      // Возвращаем пустой объект с базовым полем basis
      return { basis: 'UNKNOWN_OTHER' };
    }
    
    const betInfo = match.groups as unknown as ParsedBet;
    
    // Проверяем, что betInfo содержит поле basis
    if (!betInfo.basis) {
      // console.log('No basis found in parsed bet:', betInfo);
      betInfo.basis = 'UNKNOWN_OTHER';
    }
    
    // Логирование результата
    // console.log('Parsed bet info:', betInfo);
    
    return betInfo;
  }

  parseScore(sport: string, score?: string): ParsedScoreDto | undefined {
    if (!score) return;
    const parsed = score.match(parsers[sport])?.groups as {
      currentScore: string;
      details?: string;
      liveScore?: string;
      time?: string;
    };
    if (parsed == null) {
      this.logger.warn(`Unable to parse score of ${sport}: ${score}`);
      return;
    }

    const details = this.parseDetails(parsed.details);
    return {
      currentScore: this.parseDetails(parsed.currentScore)[0],
      details,
      liveScore: this.parseLiveScore(parsed.liveScore),
      period: details?.length,
      seconds: this.parseTimeToSeconds(parsed.time),
      text: {
        ...parsed,
        details: parsed.details?.trim(),
        liveScore: parsed.liveScore?.replace('*', ''),
      },
    };
  }
}
