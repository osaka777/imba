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

import { PartnerGuard } from '~/main/partners/authentication/partner.guard';
import { WithdrawDto } from './dto/withdraw.dto';
import { CreatePartnerPromoDto } from './dto/create-partner-promo.dto';
import { ProfileService } from './profile.service';

@Controller('affiliate-program/user')
@ApiTags('Partners')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ status: 401 })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('')
  @UseGuards(PartnerGuard)
  async user(@Req() req: { user: { id: number } }) {
    const user = await this.profileService.findById(req.user.id);

    return {
      ...user,
      affilator: user?.affilator
        ? {
            ...user.affilator,
            percent: user.affilator.percent.toString(),
            status: user.affilator.status,
          }
        : null,
    } as const;
  }

  @Get('balances')
  @UseGuards(PartnerGuard)
  async userBalances(@Req() req: { user: { id: number } }) {
    return await this.profileService.getBalances(req.user.id);
  }

  @Get('stats')
  @UseGuards(PartnerGuard)
  async userStats(
    @Req() req: { user: { id: number } },
    @Query('currency') currency?: string,
  ) {
    return await this.profileService.getStatsForPartner(req.user.id, currency);
  }

  @Get('chart-data')
  @UseGuards(PartnerGuard)
  async chartData(
    @Req() req: { user: { id: number } },
    @Query('currency') currency?: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'all' = 'month',
    @Query('metric') metric: 'income' | 'registrations' | 'ftd' = 'income',
  ) {
    return await this.profileService.getChartDataForPartner(
      req.user.id,
      currency,
      period,
      metric,
    );
  }

  @Post('withdraw')
  @UseGuards(PartnerGuard)
  async withdraw(
    @Body() data: WithdrawDto,
    @Req() req: { user: { id: number } },
  ) {
    await this.profileService.withdraw(req.user.id, data);
    return HttpStatus.OK;
  }

  @Get('operations')
  @UseGuards(PartnerGuard)
  async operations(@Req() req: { user: { id: number } }) {
    return await this.profileService.operations(req.user.id);
  }

  @Get('profile')
  @UseGuards(PartnerGuard)
  async profile(@Req() req: { user: { id: number } }) {
    return await this.profileService.findById(req.user.id);
  }

  @Patch('profile')
  @UseGuards(PartnerGuard)
  async updateProfile(
    @Body() data: { meta: any },
    @Req() req: { user: { id: number } },
  ) {
    return await this.profileService.updateProfileMeta(req.user.id, data.meta);
  }

  @Patch('password')
  @UseGuards(PartnerGuard)
  async updatePassword(
    @Body() data: { password: string },
    @Req() req: { user: { id: number } },
  ) {
    return await this.profileService.updatePassword(req.user.id, data.password);
  }

  @Get('referral-link')
  @UseGuards(PartnerGuard)
  async getReferralLink(@Req() req: { user: { id: number } }) {
    return await this.profileService.getReferralLink(req.user.id);
  }

  @Get('promo-codes')
  @UseGuards(PartnerGuard)
  async getPromoCodes(@Req() req: { user: { id: number } }) {
    return await this.profileService.getPartnerPromoCodes(req.user.id);
  }

  @Post('promo-codes')
  @UseGuards(PartnerGuard)
  async createPromoCode(
    @Req() req: { user: { id: number } },
    @Body() body: CreatePartnerPromoDto,
  ) {
    return await this.profileService.createPartnerSelfPromo(req.user.id, body);
  }

  @Get('sub-stats')
  @UseGuards(PartnerGuard)
  async getSubStats(
    @Req() req: { user: { id: number } },
    @Query('dimension') dimension: 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5' = 'sub1',
    @Query('currency') currency?: string,
  ) {
    const allowed = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;
    const dim = allowed.includes(dimension as (typeof allowed)[number])
      ? dimension
      : 'sub1';
    return await this.profileService.getSubIdStats(req.user.id, dim, currency);
  }

  @Get('withdrawal-summary')
  @UseGuards(PartnerGuard)
  async withdrawalSummary(@Req() req: { user: { id: number } }) {
    return await this.profileService.getWithdrawalSummary(req.user.id);
  }

  @Get('clients')
  @UseGuards(PartnerGuard)
  async getClients(@Req() req: { user: { id: number } }) {
    return await this.profileService.getReferredClients(req.user.id);
  }

  @Get('commissions')
  @UseGuards(PartnerGuard)
  async getCommissions(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return await this.profileService.getAffiliateCommissions(
      req.user.id,
      limit ? Number(limit) : 50,
    );
  }

  @Get('postbacks')
  @UseGuards(PartnerGuard)
  async getPostbacks(
    @Req() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    return await this.profileService.getPostbackLogs(
      req.user.id,
      limit ? Number(limit) : 20,
    );
  }

  @Post('postbacks/test')
  @UseGuards(PartnerGuard)
  async testPostback(@Req() req: { user: { id: number } }) {
    return await this.profileService.testPostback(req.user.id);
  }

  @Get('account-status')
  @UseGuards(PartnerGuard)
  async accountStatus(@Req() req: { user: { id: number } }) {
    return await this.profileService.getPartnerAccountStatus(req.user.id);
  }
}
