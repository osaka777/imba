import { setDefaultResultOrder } from 'dns';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { uploadsPathGuard } from './common/middleware/uploads-path.middleware';
import { runWithLocale } from './common/locale/locale.context';
import { parseRequestLocale } from './common/locale/parse-request-locale';

// This container has no working IPv6 egress (ENETUNREACH). Force IPv4-first
// resolution app-wide so outbound fetch()/dns.lookup() never race/stall on a
// dead-end AAAA candidate (seen causing UND_ERR_CONNECT_TIMEOUT to olimpbet.kz).
// This container has no working IPv6 egress (ENETUNREACH observed). Force
// IPv4-first resolution app-wide as a safe defensive measure.
setDefaultResultOrder('ipv4first');

const mainConfig = (app: NestExpressApplication) => {
  app.enableCors({
    origin: [
      'http://localhost:9000',
      'http://localhost:8001',
      'http://localhost:8000',
      'http://127.0.0.1:8088',
      'http://localhost:3000',
      'https://imba.bet',
      'https://partners.imba.bet',
      'https://imba.partners',
      'https://cdn.imba.bet',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'X-Locale', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  // Используем WebSocket адаптер
  app.useWebSocketAdapter(new WsAdapter(app));

  app.use(cookieParser());
  app.use((req, _res, next) => {
    const locale = parseRequestLocale(
      req.headers['x-locale'],
      req.headers['accept-language'],
    );
    runWithLocale(locale, () => next());
  });

  app.set('trust proxy', 1);

  // Защита статики uploads от path traversal и лишних директорий
  app.use(uploadsPathGuard);

  const isProduction = process.env.NODE_ENV === 'production';

  // Добавляем глобальный ValidationPipe для лучшей обработки ошибок
  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: true,
    disableErrorMessages: isProduction,
    enableDebugMessages: !isProduction,
    exceptionFactory: (errors) => {
      console.error('[ValidationPipe] Validation failed:', {
        errors: errors.map(error => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
          children: error.children
        })),
        timestamp: new Date().toISOString()
      });
      return new BadRequestException({
        message: 'Validation failed',
        errors: errors.map(error => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints
        }))
      });
    }
  }));

  // Добавляем глобальный префикс для всех маршрутов, исключая статические файлы
  app.setGlobalPrefix('api', {
    exclude: ['/public*', '/uploads*'],
  });
};

// Конфигурация для Swagger документации
const setupDocs = (app: INestApplication) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('One X')
    .setDescription('The API for One X Project')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    rawBody: true,
  });



  // Применяем конфигурации
  mainConfig(app);
  setupDocs(app);

  // Отдаём загруженные файлы (чеки) как статику по /uploads
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT || 3000;

  // Инициализируем WebSocket сервер
  await app.init();

  // Логируем успешный запуск
  console.log('Application successfully started!');

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`WebSocket server ready at: ws://localhost:${port}/api/events`);
}

bootstrap();
