import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { isPaymentMethodEnabled } from '~/main/payment-settings/payment-settings.store';

import { CrocoPayPaymentSystemService } from './crocopay-payment-system.service';
import {
  CrocopayPaymentSystemCallbackDto,
  CrocopayPaymentSystemDepositDto,
} from './dto/crocopay-payment-system-deposit.dto';

@ApiTags('CrocopayPaymentSystem')
@Controller('payment-system/crocopay')
export class CrocoPayPaymentSystemController {
  constructor(
    private readonly crocoPayPaymentSystemService: CrocoPayPaymentSystemService,
  ) {}

  private assertEnabled() {
    if (!isPaymentMethodEnabled('Crocopay')) {
      throw new BadRequestException('Crocopay отключён');
    }
  }

  @Post('callback')
  async callback(
    @Body() dto: CrocopayPaymentSystemCallbackDto,
    @Query('operationId') operationId: string,
  ) {
    return this.crocoPayPaymentSystemService.callback(dto, +operationId);
  }

  @UseGuards(AuthenticationGuard)
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  @Post('deposite')
  deposite(
    @Body() dto: CrocopayPaymentSystemDepositDto,
    @Req() req: { user: { id: number } },
  ) {
    this.assertEnabled();
    return this.crocoPayPaymentSystemService.deposite(dto, req.user.id);
  }
}
