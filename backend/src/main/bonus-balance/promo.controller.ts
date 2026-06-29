import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { BonusBalanceService } from './bonus-balance.service';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

@Controller('promo')
export class PromoController {
  constructor(private readonly bonusBalanceService: BonusBalanceService) {}

  @Post('apply')
  @UseGuards(AuthenticationGuard)
  async applyPromo(
    @Req() req: { user: { id: number } },
    @Body() body: { code?: string },
  ) {
    return this.bonusBalanceService.applyPromoCode(req.user.id, body.code ?? '');
  }
}
