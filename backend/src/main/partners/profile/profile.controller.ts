import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { WithdrawDto } from './dto/withdraw.dto';
import { ProfileService } from './profile.service';

@Controller('affiliate-program/user')
@ApiTags('Partners')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ status: 401 })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('')
  @UseGuards(AuthenticationGuard)
  async user(@Req() req: { user: { id: number } }) {
    const user = await this.profileService.findById(req.user.id);

    return {
      ...user,
      affilator: user?.affilator
        ? { ...user.affilator, percent: user.affilator.percent.toString() }
        : null,
    } as const;
  }

  @Get('balances')
  @UseGuards(AuthenticationGuard)
  async userBalances(@Req() req: { user: { id: number } }) {
    return await this.profileService.getBalances(req.user.id);
  }

  @Get('stats')
  @UseGuards(AuthenticationGuard)
  async userStats(
    @Req() req: { user: { id: number } },
    @Query('currency') currency?: string,
  ) {
    return await this.profileService.getStatsForPartner(req.user.id, currency);
  }

  @Get('chart-data')
  @UseGuards(AuthenticationGuard)
  async chartData(
    @Req() req: { user: { id: number } },
    @Query('currency') currency?: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'all' = 'month',
  ) {
    return await this.profileService.getChartDataForPartner(req.user.id, currency, period);
  }

  @Post('withdraw')
  @UseGuards(AuthenticationGuard)
  async withdraw(
    @Body() data: WithdrawDto,
    @Req() req: { user: { id: number } },
  ) {
    await this.profileService.withdraw(req.user.id, data);
    return HttpStatus.OK;
  }

  @Get('operations')
  @UseGuards(AuthenticationGuard)
  async operations(@Req() req: { user: { id: number } }) {
    return await this.profileService.operations(req.user.id);
  }

  @Get('profile')
  @UseGuards(AuthenticationGuard)
  async profile(@Req() req: { user: { id: number } }) {
    return await this.profileService.findById(req.user.id);
  }

  @Patch('profile')
  @UseGuards(AuthenticationGuard)
  async updateProfile(
    @Body() data: { meta: any },
    @Req() req: { user: { id: number } },
  ) {
    return await this.profileService.updateProfileMeta(req.user.id, data.meta);
  }

  @Patch('password')
  @UseGuards(AuthenticationGuard)
  async updatePassword(
    @Body() data: { password: string },
    @Req() req: { user: { id: number } },
  ) {
    return await this.profileService.updatePassword(req.user.id, data.password);
  }

  @Get('referral-link')
  @UseGuards(AuthenticationGuard)
  async getReferralLink(@Req() req: { user: { id: number } }) {
    return await this.profileService.getReferralLink(req.user.id);
  }
}
