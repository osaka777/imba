import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PartnersModule } from '~/main/partners/partners.module';
import { UserModule } from '~/main/user/user.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { PartnerGuard } from './partner.guard';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';

@Module({
  controllers: [AuthenticationController],
  imports: [
    UserModule, 
    PrismaModule, 
    PartnersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthenticationService, PartnerGuard, AuthRateLimitGuard],
  exports: [AuthenticationService, PartnerGuard, JwtModule],
})
export class AuthenticationModule {}
