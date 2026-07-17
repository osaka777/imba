import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { WinstonModule } from 'nest-winston';
import * as util from 'node:util';
import { join } from 'path';
import { SPLAT } from 'triple-beam';
import * as winston from 'winston';
import { format } from 'winston';

import configuration from './config/configuration';
import { LocaleModule } from './common/locale/locale.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MainModule } from './main/main.module';
import { RedisModule } from './shared/redis/redis.module';
// import { TestCalculateController } from './test-calculate.controller'; // Отключен для использования реального BetCalculationController

const logFormat = winston.format.printf(
  (info) =>
    `${new Date().toISOString()}-${info.level}: ${JSON.stringify(info.message, null, 2)}\n`,
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { context, level, message, timestamp } = info;
    const json = info[SPLAT] ? JSON.stringify(info[SPLAT]) : '';
    return `[${timestamp}] ${level.toUpperCase()}  ${message} ${json} `;
  }),
  winston.format.colorize({ all: true }),
);

const fileErrorFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { level, message, timestamp } = info;
    const json = info[SPLAT] ? JSON.stringify(info[SPLAT]) : '';
    return `[${timestamp}] ${level.toUpperCase()}  ${message} ${json}}`;
  }),
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      serveRoot: '/public',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
          level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
        }),
        new winston.transports.File({
          filename: join(process.cwd(), '..', 'data', 'logs', 'logs.json'),
          format: winston.format.combine(format.timestamp(), format.json()),
        }),
        new winston.transports.File({
          filename: join(process.cwd(), '..', 'data', 'logs', 'errors.log'),
          format: fileErrorFormat,
          level: 'error',
        }),
        new winston.transports.File({
          filename: join(process.cwd(), '..', 'data', 'logs', 'bet-results.log'),
          format: winston.format.combine(
            winston.format((info) => {
              return info.context === 'BET_RESULT' ? info : false;
            })(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf((info) => {
              return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
            })
          ),
        }),
      ],
    }),
    RedisModule,
    LocaleModule,
    IntegrationsModule,
    MainModule,
  ],
})
export class AppModule {}
