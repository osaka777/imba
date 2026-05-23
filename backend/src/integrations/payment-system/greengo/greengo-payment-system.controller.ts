import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import { AaioPaymentSystemDepositResponse } from '~/integrations/payment-system/aaio/dto/aaio-payment-system-deposit.dto';
import { GreengoPaymentSystemDepositDto } from '~/integrations/payment-system/greengo/dto/greengo-payment-system-deposit.dto';
import { GreengoPaymentSystemService } from '~/integrations/payment-system/greengo/greengo-payment-system.service';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

@ApiTags('GreengoPaymentSystem')
@Controller('payment-system/greengo')
export class GreengoPaymentSystemController {
  constructor(
    private readonly greengoPaymentSystemService: GreengoPaymentSystemService,
  ) {}

  @Post('/deposit')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: AaioPaymentSystemDepositResponse })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async deposit(
    @Body() depositDto: GreengoPaymentSystemDepositDto,
    @Req() req: { user: { id: number } },
  ) {
    return await this.greengoPaymentSystemService.deposit(
      depositDto,
      req.user.id,
    );
  }

  @Post('/check/deposit')
  @ApiOkResponse({ status: 200 })
  @ApiTags('GreengoPaymentSystem')
  async notificationDeposit(@Body() notifyDto: any) {
    return await this.greengoPaymentSystemService.incomePayment(notifyDto);
  }
}
