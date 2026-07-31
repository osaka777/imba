import { Module } from '@nestjs/common';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { FooterBadgeController, PublicFooterBadgeController } from './footer-badge.controller';
import { FooterBadgeService } from './footer-badge.service';

@Module({
  imports: [PrismaModule, AuthenticationModule],
  controllers: [FooterBadgeController, PublicFooterBadgeController],
  providers: [FooterBadgeService],
  exports: [FooterBadgeService],
})
export class FooterBadgeModule {}
