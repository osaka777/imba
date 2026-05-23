import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import { PaylinkPaymentSystemSpbBanksResponseDto } from '~/integrations/payment-system/paylink/dto/aaio-payment-system-spb-banks.dto';
import {
  PaylinkPaymentSystemDepositDto,
  PaylinkPaymentSystemDepositResponse,
} from '~/integrations/payment-system/paylink/dto/paylink-payment-system-deposit.dto';
import { PaylinkPaymentSystemDepositNotifyDto } from '~/integrations/payment-system/paylink/dto/paylink-payment-system-deposit-notify.dto';
import {
  PaylinkPaymentSystemWithdrawDto,
  PaylinkPaymentSystemWithdrawResponse,
} from '~/integrations/payment-system/paylink/dto/paylink-payment-system-withdraw.dto';
import { PaylinkPaymentSystemWithdrawNotifyDto } from '~/integrations/payment-system/paylink/dto/paylink-payment-system-withdraw-notify.dto';
import { PaylinkPaymentSystemService } from '~/integrations/payment-system/paylink/paylink-payment-system.service';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

@ApiTags('PaylinkPaymentSystem')
@Controller('payment-system/paylink')
export class PaylinkPaymentSystemController {
  constructor(
    private readonly paylinkPaymentSystemService: PaylinkPaymentSystemService,
  ) {}

  @Post('/deposit')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: PaylinkPaymentSystemDepositResponse })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async deposit(
    @Body() depositDto: PaylinkPaymentSystemDepositDto,
    @Req() req: { user: { id: number } },
    @Ip() ip,
  ) {
    return await this.paylinkPaymentSystemService.deposit(
      depositDto,
      req.user.id,
      ip,
    );
  }

  @Post('/notification-deposit')
  @ApiOkResponse({ status: 200 })
  async notificationDeposit(
    @Body()
    notifyDto: PaylinkPaymentSystemDepositNotifyDto,
  ) {
    return await this.paylinkPaymentSystemService.notificationDeposit(
      notifyDto,
    );
  }

  @Post('/notification-withdraw')
  @ApiOkResponse({ status: 200 })
  async notificationWithdraw(
    @Body()
    notifyDto: PaylinkPaymentSystemWithdrawNotifyDto,
  ) {
    return await this.paylinkPaymentSystemService.notificationWithdraw(
      notifyDto,
    );
  }

  @Get('/spb-banks')
  @ApiOkResponse({ type: PaylinkPaymentSystemSpbBanksResponseDto })
  async spbBanks() {
    return await this.paylinkPaymentSystemService.getSbpBanks();
  }

  @Post('/withdraw')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: PaylinkPaymentSystemWithdrawResponse })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async withdraw(
    @Body() withdrawDto: PaylinkPaymentSystemWithdrawDto,
    @Req() req: { user: { id: number } },
  ) {
    return await this.paylinkPaymentSystemService.withdraw(
      req.user.id,
      withdrawDto,
    );
  }
}
