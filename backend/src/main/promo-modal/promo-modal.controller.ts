import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthenticationGuard } from '../user/authentication/authentication.guard';
import { SuperuserGuard } from '../user/authentication/superuser.guard';
import { PromoModalSettingsFile } from './promo-modal.store';
import { PromoModalService } from './promo-modal.service';

@Controller('promo-modal')
export class PublicPromoModalController {
  constructor(private readonly promoModalService: PromoModalService) {}

  @Get('settings')
  getSettings() {
    return this.promoModalService.getPublicSettings();
  }

  @Get('status')
  @UseGuards(AuthenticationGuard)
  getStatus(@Req() req: { user: { id: number } }) {
    return this.promoModalService.getUserStatus(Number(req.user.id));
  }

  @Post('claim')
  @UseGuards(AuthenticationGuard)
  claim(@Req() req: { user: { id: number } }) {
    return this.promoModalService.claimDirectBonus(Number(req.user.id));
  }
}

@Controller('admin/promo-modal')
@UseGuards(SuperuserGuard)
export class AdminPromoModalController {
  constructor(private readonly promoModalService: PromoModalService) {}

  @Get()
  getSettings() {
    return this.promoModalService.getAdminSettings();
  }

  @Put()
  updateSettings(@Body() body: Partial<PromoModalSettingsFile>) {
    return this.promoModalService.updateSettings(body);
  }

  @Post('sync-promo')
  async syncPromo() {
    const settings = this.promoModalService.getAdminSettings();
    const id = await this.promoModalService.syncPromoRecord(settings);
    return { ok: true, promoId: id };
  }
}
