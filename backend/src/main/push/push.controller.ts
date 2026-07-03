import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

import { RegisterPushDto, UpdatePushNotificationsDto } from './dto/register-push.dto';
import { PushService } from './push.service';

@Controller('')
@ApiTags('Push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('user/push/register')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async register(
    @Req() req: { user: { id: number } },
    @Body() body: RegisterPushDto,
  ) {
    const device = await this.pushService.registerDevice(req.user.id, body);
    return {
      ok: true,
      registered: true,
      bets: device.notifyBets,
      deposit: device.notifyDeposit,
      withdraw: device.notifyWithdraw,
      promo: device.notifyPromo,
      liveMatch: device.notifyLiveMatch,
    };
  }

  @Post('push/register-guest')
  @HttpCode(200)
  async registerGuest(@Body() body: RegisterPushDto) {
    const device = await this.pushService.registerDevice(null, body);
    return { ok: true, id: device.id };
  }

  @Get('user/push/notifications')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async getNotifications(
    @Req() req: { user: { id: number } },
    @Headers('x-fcm-token') fcmToken?: string,
  ) {
    return this.pushService.getPreferences(req.user.id, fcmToken);
  }

  @Patch('user/push/notifications')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async updateNotifications(
    @Req() req: { user: { id: number } },
    @Headers('x-fcm-token') fcmToken: string | undefined,
    @Body() body: UpdatePushNotificationsDto,
  ) {
    if (!fcmToken) {
      return { ok: false, reason: 'missing_token' };
    }
    return this.pushService.updatePreferences(req.user.id, fcmToken, body);
  }

  @Delete('user/push')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  async unlink(
    @Req() req: { user: { id: number } },
    @Headers('x-fcm-token') fcmToken: string | undefined,
  ) {
    if (fcmToken) {
      await this.pushService.unlinkDevice(req.user.id, fcmToken);
    }
  }
}
