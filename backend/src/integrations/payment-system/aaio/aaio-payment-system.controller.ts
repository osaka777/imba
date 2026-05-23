import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import {
  AaioPaymentSystemDepositDto,
  AaioPaymentSystemDepositResponse,
} from '~/integrations/payment-system/aaio/dto/aaio-payment-system-deposit.dto';
import {
  AaioPaymentSystemWithdrawDto,
  AaioPaymentSystemWithdrawResponseDto,
} from '~/integrations/payment-system/aaio/dto/aaio-payment-system-withdraw.dto';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

import { AAIOPaymentSystemService } from '../aaio/aaio-payment-system.service';
import { AaioPaymentSystemPhoneOperatorsDto } from '../aaio/dto/aaio-payment-system-phone-operators.dto';
import { AaioPaymentSystemSpbBanksDto } from '../aaio/dto/aaio-payment-system-spb-banks.dto';
import { AaioPaymentSystemWithdrawMethodsDto } from '../aaio/dto/aaio-payment-system-withdraw-methods.dto';

@ApiTags('AaioPaymentSystem')
@Controller('payment-system/aaio')
export class AaioPaymentSystemController {
  constructor(
    private readonly aaioPaymentSystemService: AAIOPaymentSystemService,
  ) {}

  @Post('/deposit')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: AaioPaymentSystemDepositResponse })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async deposit(
    @Body() depositDto: AaioPaymentSystemDepositDto,
    @Req() req: { user: { id: number } },
  ) {
    const { link } = await this.aaioPaymentSystemService.deposit(
      depositDto,
      req.user.id,
    );
    return {
      link: link,
    };
  }

  @Post('/notification/deposit')
  @ApiOkResponse({ status: 200 })
  @ApiTags('AaioPaymentSystem')
  async notificationDeposit(@Body() notifyDto: any) {
    const result = await this.aaioPaymentSystemService.incomePayment(notifyDto);
    return {
      success: true,
      status: 'SUCCESS',
      orderId: notifyDto.order_id,
      message: 'Deposit notification processed successfully'
    };
  }

  @Post('/notification/withdraw')
  @ApiOkResponse({ status: 200 })
  async notificationWithdraw(@Body() notifyDto: any) {
    const result = await this.aaioPaymentSystemService.outcomePayment(notifyDto);
    return {
      success: true,
      status: 'SUCCESS',
      orderId: notifyDto.my_id,
      message: 'Withdraw notification processed successfully'
    };
  }

  @Get('/phone-operators')
  @ApiOkResponse({ type: AaioPaymentSystemPhoneOperatorsDto })
  async phoneOperators() {
    return await this.aaioPaymentSystemService.getPhoneOperators();
  }

  @Get('/spb-banks')
  @ApiOkResponse({ type: AaioPaymentSystemSpbBanksDto })
  async spbBanks() {
    return await this.aaioPaymentSystemService.getSbpBanks();
  }

  @Post('/withdraw')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: AaioPaymentSystemWithdrawResponseDto })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async withdraw(
    @Body() withdrawDto: AaioPaymentSystemWithdrawDto,
    @Req() req: { user: { id: number } },
  ) {
    return await this.aaioPaymentSystemService.withdraw(
      req.user.id,
      withdrawDto,
    );
  }

  @Get('/withdraw-methods')
  @ApiOkResponse({ type: AaioPaymentSystemWithdrawMethodsDto })
  async withdrawMethods() {
    return await this.aaioPaymentSystemService.getWithdrawMethods();
  }
}
