import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Operation, OperationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios from 'axios';
import { ShaTS } from 'sha-ts';

import { PaymentSystemWithdrawNotificationDto } from '~/integrations/payment-system/dto/payment-system-notification.dto';
import { PaymentSignatureNotMatch } from '~/integrations/payment-system/exception/payment-signature-not-match';
import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';
import { CurrencyNotFound } from '~/main/currency/exception/currency-not-found.exception';

import {
  AaioPaymentSystemDepositDto,
  AaioPaymentSystemDepositResponse,
} from './dto/aaio-payment-system-deposit.dto';
import {
  AaioPaymentSystemDepositNotificationDto,
  AaioPaymentSystemWithdrawNotificationDto,
} from './dto/aaio-payment-system-notification.dto';
import { AaioPaymentSystemPhoneOperatorsDto } from './dto/aaio-payment-system-phone-operators.dto';
import { AaioPaymentSystemRatesDto } from './dto/aaio-payment-system-rates.dto';
import { AaioPaymentSystemSpbBanksDto } from './dto/aaio-payment-system-spb-banks.dto';
import {
  AaioPaymentSystemWithdrawDto,
  AaioPaymentSystemWithdrawResponseDto,
} from './dto/aaio-payment-system-withdraw.dto';

const AAIO_PHONE_OPERATORS = [
  {
    phoneId: 'beeline_ru',
    phoneName: 'Билайн',
  },
  {
    phoneId: 'tele2',
    phoneName: 'Tele2',
  },
  {
    phoneId: 'mts_ru',
    phoneName: 'МТС',
  },
  {
    phoneId: 'megafon_ru',
    phoneName: 'Мегафон',
  },
];

@Injectable()
export class AAIOPaymentSystemService {
  private api = axios.create({
    baseURL: this.configService.get<string>('AAIO_API'),
    headers: {
      Accept: 'application/json',
      'X-Api-Key': this.configService.get<string>('AAIO_API_KEY'),
    },
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSystemService: PaymentSystemService,
  ) {}

  private async generatePaymentUrl(
    amount: Decimal,
    currency: string,
    sign: string,
    orderID: number,
  ) {
    const shopID = this.configService.get<string>('AAIO_ID');
    const url = this.configService.get<string>('AAIO_URL');
    // AAIO commonly expects amount with 2 decimal places
    const amountFixed = amount.toFixed(2, Decimal.ROUND_UP).toString();
    const params = {
      amount: amountFixed,
      currency: currency,
      merchant_id: shopID,
      order_id: orderID.toString(),
      sign: sign,
    };
    return `${url}/?${new URLSearchParams(params).toString()}`;
  }

  private async generateSign(
    amount: string,
    currency: string,
    operationID: number,
    shopSecret: string,
  ): Promise<string> {
    const shopID = this.configService.get<string>('AAIO_ID');
    // Ensure amount is two decimals for signature consistency
    const normalizedAmount = new Decimal(amount).toFixed(2, Decimal.ROUND_UP).toString();
    const sign = `${shopID}:${normalizedAmount}:${currency}:${shopSecret}:${operationID}`;
    return ShaTS.sha256(sign);
  }

  private async getRate(currency: string): Promise<Decimal> {
    try {
      const { data } =
        await this.api.get<AaioPaymentSystemRatesDto>('/rates-payoff');
      return new Decimal(data[currency]);
    } catch (e) {
      return undefined;
    }
  }

  async checkIncomePayment(payment: Operation, sign: string) {
    const shopSecret = this.configService.get<string>('AAIO_SECOND_SECRET');
    const generatedSign = await this.generateSign(
      payment.amount.toFixed(2, Decimal.ROUND_UP).toString(),
      payment.currencyCode,
      payment.id,
      shopSecret,
    );
    return sign === generatedSign;
  }

  async checkOutcomePayment(payment: Operation, sign: string) {
    const accountAlertCheckSecret =
      this.configService.get<string>('AAIO_SECOND_SECRET');
    const alertId = (payment.meta as { alertID: string }).alertID;
    return (
      sign ===
      ShaTS.sha256(
        `${alertId}:${accountAlertCheckSecret}:${payment.amount.toFixed(2, Decimal.ROUND_UP).toString()}`,
      )
    );
  }

  async convertCurrency(currency: string, amount: Decimal): Promise<Decimal> {
    if (currency === 'RUB' || currency === 'KZT') {
      return amount;
    }

    const rate = await this.getRate(currency);
    if (rate === undefined) {
      throw new CurrencyNotFound();
    }
    return rate.times(amount);
  }

  async deposit(
    data: AaioPaymentSystemDepositDto,
    userId: number,
  ): Promise<AaioPaymentSystemDepositResponse> {
    const amount = new Decimal(data.amount);
    const payment = await this.paymentSystemService.deposit({
      amount: amount,
      currency: data.currency,
      userId,
    });
    const shopSecret = this.configService.get<string>('AAIO_SECRET');
    const sign = await this.generateSign(
      amount.toFixed(2, Decimal.ROUND_UP).toString(),
      data.currency,
      payment.id,
      shopSecret,
    );

    const link = await this.generatePaymentUrl(
      amount,
      data.currency,
      sign,
      payment.id,
    );
    return { link };
  }

  async getPhoneOperators(): Promise<AaioPaymentSystemPhoneOperatorsDto> {
    return {
      list: AAIO_PHONE_OPERATORS,
      type: 'success',
    };
  }

  async getSbpBanks(): Promise<AaioPaymentSystemSpbBanksDto> {
    const { data } =
      await this.api.get<AaioPaymentSystemSpbBanksDto>('/sbp-banks-payoff');
    return data;
  }

  async getWithdrawMethods(): Promise<AaioPaymentSystemSpbBanksDto> {
    const { data } =
      await this.api.get<AaioPaymentSystemSpbBanksDto>('/methods-payoff');
    return data;
  }

  async incomePayment(data: AaioPaymentSystemDepositNotificationDto) {
    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.order_id),
    );

    const isValid = await this.checkIncomePayment(payment, data.sign);
    if (!isValid) {
      throw new PaymentSignatureNotMatch();
    }

    return this.paymentSystemService.updateOperation(
      OperationStatus.SUCCESS,
      payment.id,
    );
  }

  async notification(
    data:
      | AaioPaymentSystemDepositNotificationDto
      | AaioPaymentSystemWithdrawNotificationDto,
  ) {
    if (data instanceof AaioPaymentSystemDepositNotificationDto) {
      return this.incomePayment(data);
    } else if (data instanceof AaioPaymentSystemWithdrawNotificationDto) {
      return this.outcomePayment(data);
    }
  }

  async outcomePayment(data: PaymentSystemWithdrawNotificationDto) {
    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.my_id),
    );
    const isValid = await this.checkOutcomePayment(payment, data.sign);
    if (!isValid) {
      throw new PaymentSignatureNotMatch();
    }
    if (data.status === 'success') {
      return this.paymentSystemService.updateOperation(
        OperationStatus.SUCCESS,
        payment.id,
      );
    }
    return this.paymentSystemService.updateOperation(
      OperationStatus.FAILED,
      payment.id,
    );
  }

  async withdraw(userId: number, data: AaioPaymentSystemWithdrawDto) {
    const amount = new Decimal(data.amount);
    const { operationId } = await this.paymentSystemService.withdraw({
      amount,
      currency: data.currency,
      userId,
      method: 'aaio',
      wallet: data.wallet
    });
    const reculculatedAmount = await this.convertCurrency(
      data.currency,
      amount,
    );
    try {
      const response =
        await this.api.post<AaioPaymentSystemWithdrawResponseDto>(
          '/create-payoff',
          {
            amount: reculculatedAmount,
            bank: data.bank,
            method: data.method,
            my_id: operationId.toString(),
            phone_operator: data.phone_operator,
            wallet: data.wallet,
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );
      if (response.data.type === 'success') {
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
