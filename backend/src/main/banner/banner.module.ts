import { Module } from '@nestjs/common';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { BannerController, PublicBannerController } from './banner.controller';
import { BannerService } from './banner.service';

@Module({
  imports: [
    PrismaModule,
    AuthenticationModule,
  ],
  controllers: [BannerController, PublicBannerController],
  providers: [BannerService],
  exports: [BannerService],
})
export class BannerModule {}