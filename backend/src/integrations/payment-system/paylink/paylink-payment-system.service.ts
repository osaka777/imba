import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios from 'axios';
import { createHmac } from 'node:crypto';

import { PaymentSignatureNotMatch } from '~/integrations/payment-system/exception/payment-signature-not-match';
import { PaylinkPaymentSystemSpbBanksResponseDto } from '~/integrations/payment-system/paylink/dto/aaio-payment-system-spb-banks.dto';
import { PaylinkPaymentSystemDepositNotifyDto } from '~/integrations/payment-system/paylink/dto/paylink-payment-system-deposit-notify.dto';
import {
  PaylinkPaymentSystemWithdrawDto,
  PaylinkPaymentSystemWithdrawResponse,
} from '~/integrations/payment-system/paylink/dto/paylink-payment-system-withdraw.dto';
import { PaylinkPaymentSystemWithdrawNotifyDto } from '~/integrations/payment-system/paylink/dto/paylink-payment-system-withdraw-notify.dto';
import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';

import {
  PaylinkPaymentSystemDepositDto,
  PaylinkPaymentSystemDepositResponse,
} from './dto/paylink-payment-system-deposit.dto';

@Injectable()
export class PaylinkPaymentSystemService {
  private api = axios.create({
    baseURL: this.configService.get<string>('PAYLINK_BASE_URL'),
    headers: {
      Accept: 'application/json',
    },
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSystemService: PaymentSystemService,
  ) {}

  private async generateSign(data: string): Promise<string> {
    const secret = this.configService.get<string>('PAYLINK_API_KEY');
    return createHmac('sha1', secret).update(data).digest('base64');
  }

  async deposit(
    data: PaylinkPaymentSystemDepositDto,
    userId: number,
    ip: string,
  ): Promise<PaylinkPaymentSystemDepositResponse> {
    const merchID = this.configService.get<string>('PAYLINK_MERCH_ID');
    const payment = await this.paymentSystemService.deposit({
      amount: new Decimal(data.amount),
      currency: data.currency,
      userId,
    });
    const sign = await this.generateSign(merchID);
    const request = {
      finish_url: 'https://imba.bet/',
      merch_id: merchID,
      user_id: userId.toString(),
      user_ip: ip,
      user_ref: payment.id.toString(),
      ...data,
      amount: data.amount.toString(),
      notification_url: this.configService.get<string>(
        'PAYLINK_DEPOSIT_NOTIFICATION_URL',
      ),
      sign: sign,
    };
    try {
      const response = await this.api.post<PaylinkPaymentSystemDepositResponse>(
        '/payment',
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            Sign: sign,
          },
        },
      );
      if (response.data.ok === true) {
        return response.data;
      }
    } catch (e) {
      const errorMessage = e?.response?.data?.ok;
      if (errorMessage) {
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
      } else {
        throw new HttpException('error', HttpStatus.BAD_REQUEST);
      }
    }
  }

  async getSbpBanks(): Promise<PaylinkPaymentSystemSpbBanksResponseDto> {
    const { data } = await axios.get<PaylinkPaymentSystemSpbBanksResponseDto>(
      'https://docs.paylink.vip/banks.js',
    );
    return data;
  }

  async notificationDeposit(data: PaylinkPaymentSystemDepositNotifyDto) {
    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.user_ref),
    );
    const sign = await this.generateSign(data.id);
    if (sign !== data.sign) {
      throw new PaymentSignatureNotMatch();
    }
    if (data.status === 'executed') {
      return this.paymentSystemService.updateOperation(
        OperationStatus.SUCCESS,
        payment.id,
      );
    } else if (data.status === 'cancelled') {
      return this.paymentSystemService.updateOperation(
        OperationStatus.FAILED,
        payment.id,
      );
    }
  }

  async notificationWithdraw(data: PaylinkPaymentSystemWithdrawNotifyDto) {
    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.user_ref),
    );
    const sign = await this.generateSign(data.id);
    if (sign !== data.sign) {
      throw new PaymentSignatureNotMatch();
    }
    if (data.status === 'executed') {
      return this.paymentSystemService.updateOperation(
        OperationStatus.SUCCESS,
        payment.id,
      );
    } else if (data.status === 'cancelled') {
      return this.paymentSystemService.updateOperation(
        OperationStatus.FAILED,
        payment.id,
      );
    }
  }

  async withdraw(userId: number, data: PaylinkPaymentSystemWithdrawDto) {
    const amount = new Decimal(data.amount);
    const merchID = this.configService.get<string>('PAYLINK_MERCH_ID');
    const { operationId } = await this.paymentSystemService.withdraw({
      amount,
      currency: data.currency,
      userId,
      method: 'paylink',
      wallet: data.pan
    });
    const sign = await this.generateSign(merchID);
    try {
      const response =
        await this.api.post<PaylinkPaymentSystemWithdrawResponse>(
          '/payout',
          {
            merch_id: merchID,
            notification_url: this.configService.get<string>(
              'PAYLINK_WITHDRAW_NOTIFICATION_URL',
            ),
            sign: sign,
            user_ref: operationId.toString(),
            ...data,
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );
      if (response.data.ok === true) {
        return HttpStatus.OK;
      }
    } catch (e) {
      const errorMessage = e?.response?.data?.message;
      if (errorMessage) {
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
      }
    }
    throw new HttpException('error', HttpStatus.BAD_REQUEST);
  }
}
