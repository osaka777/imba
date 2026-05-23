import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Operation, OperationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios from 'axios';
import * as crypto from 'crypto';
import { randomUUID } from 'node:crypto';

import {
  BovaPaymentSystemDepositNotificationDto,
  BovaPaymentSystemWithdrawNotificationDto,
} from '~/integrations/payment-system/bova/dto/bova-payment-system-notification.dto';
import { PaymentSignatureNotMatch } from '~/integrations/payment-system/exception/payment-signature-not-match';
import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';
import { CurrencyNotFound } from '~/main/currency/exception/currency-not-found.exception';
import { PrismaService } from '~/prisma/prisma.service';

import {
  BovaPaymentSystemDepositDto,
  BovaPaymentSystemDepositResponse,
} from './dto/bova-payment-system-deposit.dto';
import { BovaPaymentSystemRatesDto } from './dto/bova-payment-system-rates.dto';
import { BovaPaymentSystemSpbBanksDto } from './dto/bova-payment-system-spb-banks.dto';
import {
  BovaPaymentSystemWithdrawDto,
} from './dto/bova-payment-system-withdraw.dto';

const BOVA_SBP_BANKS = [
  {
    id: '100000000111',
    name: 'Сбер',
  },
  {
    id: '100000000004',
    name: 'Тинькфф',
  },
  {
    id: '100000000005',
    name: 'ВТБ',
  },
  {
    id: '100000000001',
    name: 'Газпромбанк',
  },
  {
    id: '100000000008',
    name: 'АЛЬФА-БАНК',
  },
  {
    id: '100000000013',
    name: 'Совкомбанк',
  },
  {
    id: '100000000015',
    name: 'ОТКРЫТИЕ Банк',
  },
  {
    id: '100000000016',
    name: 'Почта Банк',
  },
  {
    id: '100000000273',
    name: 'Озон Банк',
  },
  {
    id: '100000000150',
    name: 'Яндекс Банк',
  },
  {
    id: '100000000284',
    name: 'Банк Точка',
  },
  {
    id: '100000000059',
    name: 'Центр-инвест',
  },
];

@Injectable()
export class BovaPaymentSystemService {
  private api = axios.create({
    baseURL: this.configService.get<string>('BOVA_BASE_URL'),
    headers: {
      Accept: 'application/json',
    },
  });
  private merchantApi = axios.create({
    baseURL: this.configService.get<string>('BOVA_MERCHANT_BASE_URL'),
    headers: {
      Accept: 'application/json',
    },
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSystemService: PaymentSystemService,
    private readonly prismaService: PrismaService,
  ) {}

  private async generatePaymentUrl(
    amount: Decimal,
    currency: string,
    ip: string,
    payment: Operation,
    bank: string | undefined,
    method: string,
    wallet: string,
    email: string,
    name: string,
  ) {
    const userID = this.configService.get<string>('BOVA_USERID_KEY');
    // try {
    //   const params = {
    //     amount: amount.toNumber(),
    //     callback_url:
    //       'https://imba.bet/api/payment-system/bova/notification/deposit',
    //     currency: currency.toLowerCase(),
    //     customer_name: 'Ivan Vasiliev',
    //     email: 'test@test.ru',
    //     lifetime: 60 * 30,
    //     merchant_id: payment.id.toString(),
    //     payeer_identifier: payment.userId.toString(),
    //     payeer_ip: ip.toString(),
    //     payeer_type: 'ftd',
    //     redirect_url: 'https://imba.bet/',
    //     user_uuid: userID.toString(),
    //   };
    //   const sign = await this.generateSign(JSON.stringify(params));
    //   const { data } =
    //     await this.merchantApi.post<BovaPaymentSystemDepositResponse>(
    //       '/deposits',
    //       params,
    //       {
    //         headers: {
    //           Signature: sign,
    //         },
    //       },
    //     );
    //   if (data.status === 'ok') {
    //     return data.data.form_url;
    //   }
    // } catch (e) {
    //   console.log(e);
    // }
    const uuid = randomUUID();
    try {
      const params = {
        amount: amount.toNumber(),
        bank_name: 'sberbank',
        callback_url:
          'https://imba.bet//api/payment-system/bova/notification/deposit',
        currency: currency.toLowerCase(),
        customer_name: name,
        email: 'email@mail.ru',
        lifetime: 60 * 30,
        merchant_id: payment.id.toString(),
        payeer_card_number: wallet,
        payeer_identifier: uuid,
        payeer_ip: ip.toString(),
        payeer_type: 'ftd',
        payment_method: method,
        redirect_url: 'https://imba.bet/',
        user_uuid: userID,
      };
      const sign = await this.generateSign(JSON.stringify(params));
      const { data } = await this.api.post<BovaPaymentSystemDepositResponse>(
        '/p2p_transactions',
        params,
        {
          headers: {
            Signature: sign,
          },
        },
      );
      if (data.result_code === 'ok') {
        return data.payload.form_url;
      }
    } catch (e) {
      if (e?.response?.data?.errors?.error_message) {
        throw new BadRequestException(e?.response?.data?.errors?.error_message);
      }
      throw new BadRequestException('Something went wrong');
    }
    return `https://imba.bet/`;
  }

  private async generateSign(body: string): Promise<string> {
    const shopSecret = this.configService.get<string>('BOVA_API_KEY');
    const sign = `${shopSecret}${body}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(sign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }

  private async getRate(currency: string): Promise<Decimal> {
    try {
      const { data } =
        await this.api.get<BovaPaymentSystemRatesDto>('/rates-payoff');
      return new Decimal(data[currency]);
    } catch (e) {
      return undefined;
    }
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
    data: BovaPaymentSystemDepositDto,
    userId: number,
    ip: string,
  ): Promise<BovaPaymentSystemDepositResponse> {
    const amount = new Decimal(data.amount);
    const payment = await this.paymentSystemService.deposit({
      amount: amount,
      currency: data.currency,
      userId,
    });

    const link = await this.generatePaymentUrl(
      amount,
      data.currency,
      ip,
      payment,
      data.bank,
      data.method,
      data.wallet,
      'test@test.ru',
      data.name,
    );
    return {
      payload: {
        form_url: link,
      },
      result_code: 'ok',
    };
  }

  async getSbpBanks(): Promise<BovaPaymentSystemSpbBanksDto> {
    return {
      list: BOVA_SBP_BANKS,
      type: 'success',
    };
  }

  async getWithdrawMethods(): Promise<BovaPaymentSystemSpbBanksDto> {
    const { data } =
      await this.api.get<BovaPaymentSystemSpbBanksDto>('/methods-payoff');
    return data;
  }

  async incomePayment(
    data: BovaPaymentSystemDepositNotificationDto,
    sign: string,
  ) {
    const generatedSign = await this.generateSign(JSON.stringify(data));
    if (generatedSign !== sign) {
      throw new PaymentSignatureNotMatch();
    }

    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.merchant_id),
    );
    if (data.status !== 'successed') {
      await this.paymentSystemService.updateOperation(
        OperationStatus.FAILED,
        payment.id,
      );
      return;
    }
    await this.paymentSystemService.updateOperation(
      OperationStatus.SUCCESS,
      payment.id,
    );
    return HttpStatus.OK;
  }
  async outcomePayment(
    data: BovaPaymentSystemWithdrawNotificationDto,
    sign: string,
  ) {
    const generatedSign = await this.generateSign(JSON.stringify(data));

    if (generatedSign !== sign) {
      throw new PaymentSignatureNotMatch();
    }

    const payment = await this.paymentSystemService.findPaymentById(
      Number(data.merchant_id),
    );
    if (data.status === 'paid') {
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

  private mapFrontendMethodToBovaMethod(frontendMethod: string): string {
    const methodMapping: Record<string, string> = {
      'cards_kz': 'cards_ru',      // Казахстанские карты -> российские карты
      'cards_foreign': 'cards_ru', // Иностранные карты -> российские карты
      'usdt_trc20': 'crypto',      // USDT TRC20 -> криптовалюта
      'usdt_tron': 'crypto',       // USDT TRON -> криптовалюта
    };
    
    return methodMapping[frontendMethod] || frontendMethod;
  }

  async withdraw(userId: number, data: BovaPaymentSystemWithdrawDto) {
    const requestId = `${userId}-${data.amount}-${data.method}-${Date.now()}`;
    
    // Маппинг метода из фронтенда в формат Bova API
    const bovaMethod = this.mapFrontendMethodToBovaMethod(data.method);
    
    // Проверяем баланс пользователя перед операцией
    const balanceBefore = await this.prismaService.balance.findFirst({
      where: {
        userId,
        currencyCode: data.currency
      }
    });

   

    // Проверяем на дублирующие запросы ПЕРЕД любыми операциями
    // Временно отключено для отладки
    /*
    const recentRequests = await this.prismaService.withdrawRequest.findMany({
      where: {
        userId,
        amount: new Decimal(data.amount),
        currencyCode: data.currency,
        type: data.method,
        wallet: data.wallet,
        status: 'WAITING',
        createdAt: {
          gte: new Date(Date.now() - 30000) // 30 секунд
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentRequests.length > 0) {
      console.error('[BovaPaymentSystem] Duplicate request blocked:', {
        requestId,
        existingRequests: recentRequests.map(r => ({
          id: r.id,
          createdAt: r.createdAt,
          amount: r.amount.toString()
        }))
      });
      throw new BadRequestException('Duplicate withdrawal request detected. Please wait before trying again.');
    }
    */

    if (data.amount < 500) {
      throw new BadRequestException(
        'Сумма должна быть более 500 ' + data.currency,
      );
    }

    if (!data.method || data.method.trim() === '') {
      console.error('[BovaPaymentSystem] Method is missing or empty:', {
        requestId,
        method: data.method,
        methodType: typeof data.method
      });
      throw new BadRequestException('Withdrawal method is required');
    }
    
    const amount = new Decimal(data.amount);
    
    // Создаем запись о выводе через PaymentSystemService
    const { operationId } = await this.paymentSystemService.withdraw({
      amount,
      currency: data.currency,
      userId,
      method: bovaMethod,
      wallet: data.wallet,
    });


    const userID = this.configService.get<string>('BOVA_USERID_KEY');
    
    const params = {
      amount: data.amount,
      bank: data.bank,
      callback_url:
        'https://imba.bet/api/payment-system/bova/notification/withdraw',
      currency: data.currency.toLowerCase(),
      lifetime: 60 * 30,
      merchant_id: operationId,
      payment_method: bovaMethod,
      to_card: data.wallet,
      user_uuid: userID,
    };

    const sign = await this.generateSign(JSON.stringify(params));
    
    try {
    

      // Mock response для отладки
      const mockResponse = {
        data: {
          id: `mock_${Date.now()}`,
          result_code: 'ok'
        }
      };

      /*
      const response = await this.api.post<BovaPaymentSystemWithdrawResponseDto>(
        '/mass_transactions',
        params,
        {
          headers: {
            Signature: sign,
          },
        },
      );

      if (response.data.result_code !== 'ok') {
        console.error('[BovaPaymentSystem] Payment system error:', {
          requestId,
          response: response.data
        });
        throw new BadRequestException('Payment system returned error');
      }
      */


      return mockResponse.data;
    } catch (e) {
      // Логируем ошибку для отладки
      console.error('[BovaPaymentSystem] Withdrawal error:', {
        requestId,
        error: e?.response?.data || e.message,
        method: data.method,
        bovaMethod: bovaMethod
      });
      
      // В случае ошибки отменяем операцию
      await this.paymentSystemService.updateOperation(
        OperationStatus.FAILED,
        operationId,
      );

      // Проверяем баланс после отмены операции
      const balanceAfterCancel = await this.prismaService.balance.findFirst({
        where: {
          userId,
          currencyCode: data.currency
        }
      });

      

      if (e?.response?.data?.message) {
        throw new BadRequestException(e.response.data.message);
      }
      throw new BadRequestException('Failed to process withdrawal');
    }
  }
}
