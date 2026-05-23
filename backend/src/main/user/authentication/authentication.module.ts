import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UserModule } from '../user.module';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationGuard } from './authentication.guard';
import { AuthenticationService } from './authentication.service';
import { SuperuserGuard } from './superuser.guard';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';

@Module({
  controllers: [AuthenticationController],
  exports: [AuthenticationGuard, AuthenticationService, SuperuserGuard],
  imports: [JwtModule, forwardRef(() => UserModule)],
  providers: [AuthenticationService, AuthenticationGuard, SuperuserGuard, AuthRateLimitGuard],
})
export class AuthenticationModule {}
