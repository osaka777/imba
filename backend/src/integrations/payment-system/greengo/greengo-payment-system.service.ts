import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios from 'axios';

import { PaymentSystemService } from '~/integrations/payment-system/payment-system.service';
import { PrismaService } from '~/prisma/prisma.service';

import {
  GreengoPaymentSystemDepositDto,
  GreengoPaymentSystemDepositResp,
} from './dto/greengo-payment-system-deposit.dto';
import { GreengoPaymentSystemDepositNotificationDto } from './dto/greengo-payment-system-notification.dto';

@Injectable()
export class GreengoPaymentSystemService {
  private api = axios.create({
    baseURL: this.configService.get<string>('GREENGO_API'),
    headers: {
      'Api-Secret': this.configService.get<string>('GREENGO_API_KEY'),
      'Content-Type': 'application/json',
    },
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSystemService: PaymentSystemService,
    private readonly prismaService: PrismaService,
  ) {}

  async deposit(dto: GreengoPaymentSystemDepositDto, userId: number) {
    try {
      const params = {
        from_amount: dto.amount.toString(),
        payment_method: 'kzt',
      };
      const { data } = await this.api.post<GreengoPaymentSystemDepositResp>(
        '/order/create',
        params,
      );
      if (data.response === 'success') {
        const amount = new Decimal(dto.amount);
        const payment = await this.paymentSystemService.deposit({
          amount: amount,
          currency: dto.currency,
          userId,
        });
        await this.prismaService.greengoRequests.create({
          data: {
            operationId: payment.id,
            orderId: data.items[0].order_id,
          },
        });
        return data.items[0];
      }
    } catch (e) {
      console.log(e);
      throw new BadRequestException('Something went wrong');
    }
    throw new BadRequestException('Something went wrong');
  }

  async incomePayment(dto: GreengoPaymentSystemDepositNotificationDto) {
    const greengoReq = await this.prismaService.greengoRequests.findFirst({
      where: {
        orderId: dto.id,
      },
    });

    try {
      const params = {
        order_id: [dto.id],
      };
      const { data } = await this.api.post<any>('/order/check', params);
      if (
        Number(data.data.orders[0].order_id) === Number(greengoReq.orderId) &&
        (data.data.orders[0].order_status === 'payed' ||
          data.data.orders[0].order_status === 'completed')
      ) {
        return this.paymentSystemService.updateOperation(
          OperationStatus.SUCCESS,
          greengoReq.operationId,
        );
      }
    } catch (e) {
      console.log(e);
      throw new BadRequestException('Something went wrong');
    }
    throw new BadRequestException('В ожидании оплаты');
  }
}
