import {
  BadRequestException,
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
import { BovaPaymentSystemService } from '~/integrations/payment-system/bova/bova-payment-system.service';
import {
  BovaPaymentSystemDepositDto,
  BovaPaymentSystemDepositResponse,
} from '~/integrations/payment-system/bova/dto/bova-payment-system-deposit.dto';
import { BovaPaymentSystemSpbBanksDto } from '~/integrations/payment-system/bova/dto/bova-payment-system-spb-banks.dto';
import {
  BovaPaymentSystemWithdrawDto,
  BovaPaymentSystemWithdrawResponseDto,
} from '~/integrations/payment-system/bova/dto/bova-payment-system-withdraw.dto';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';

@ApiTags('BovaPaymentSystem')
@Controller('payment-system/bova')
export class BovaPaymentSystemController {
  constructor(
    private readonly bovaPaymentSystemService: BovaPaymentSystemService,
  ) {}

  @Post('/deposit')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: BovaPaymentSystemDepositResponse })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async deposit(
    @Body() depositDto: BovaPaymentSystemDepositDto,
    @Req() req: { user: { id: number } },
    @Ip() ip,
  ) {
    const data = await this.bovaPaymentSystemService.deposit(
      depositDto,
      req.user.id,
      ip,
    );
    return data;
  }

  @Post('/notification/deposit')
  @ApiOkResponse({ status: 200 })
  async notificationDeposit(@Req() req: Request, @Body() notifyDto: any) {
    const sign = req.headers['signature'];
    return await this.bovaPaymentSystemService.incomePayment(notifyDto, sign);
  }

  @Post('/notification/withdraw')
  @Get('/notification/withdraw')
  @ApiOkResponse({ status: 200 })
  async notificationWithdraw(@Req() req: Request, @Body() notifyDto: any) {
    const sign = req.headers.get('Signature');
    return await this.bovaPaymentSystemService.outcomePayment(notifyDto, sign);
  }

  @Get('/spb-banks')
  @ApiOkResponse({ type: BovaPaymentSystemSpbBanksDto })
  async spbBanks() {
    return await this.bovaPaymentSystemService.getSbpBanks();
  }

  @Post('/withdraw')
  @UseGuards(AuthenticationGuard)
  @ApiOkResponse({ type: BovaPaymentSystemWithdrawResponseDto })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async withdraw(
    @Body() withdrawDto: BovaPaymentSystemWithdrawDto,
    @Req() req: Request & { user: { id: number } },
  ) {

    // Validate required fields manually for debugging
    if (!withdrawDto.amount || withdrawDto.amount <= 0) {
      console.error('[BovaController] Invalid amount:', withdrawDto.amount);
      throw new BadRequestException('Invalid amount');
    }

    if (!withdrawDto.method || withdrawDto.method.trim() === '') {
      console.error('[BovaController] Invalid method:', withdrawDto.method);
      throw new BadRequestException('Invalid method');
    }

    if (!withdrawDto.wallet || withdrawDto.wallet.trim() === '') {
      console.error('[BovaController] Invalid wallet:', withdrawDto.wallet);
      throw new BadRequestException('Invalid wallet');
    }

    if (!withdrawDto.currency || withdrawDto.currency.trim() === '') {
      console.error('[BovaController] Invalid currency:', withdrawDto.currency);
      throw new BadRequestException('Invalid currency');
    }

    try {
      const result = await this.bovaPaymentSystemService.withdraw(
        req.user.id,
        withdrawDto,
      );
 
      return result;
    } catch (error) {
      console.error('[BovaController] Withdraw error:', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id,
        dto: withdrawDto,
        errorType: error.constructor.name
      });
      throw error;
    }
  }
}
