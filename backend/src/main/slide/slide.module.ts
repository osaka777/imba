import { Module } from '@nestjs/common';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { SlideController, PublicSlideController } from './slide.controller';
import { SlideService } from './slide.service';

@Module({
  imports: [PrismaModule, AuthenticationModule],
  controllers: [SlideController, PublicSlideController],
  providers: [SlideService],
  exports: [SlideService],
})
export class SlideModule {}
