import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { LocaleMiddleware } from "./locale.middleware";

@Module({})
export class LocaleModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LocaleMiddleware).forRoutes("*");
  }
}
