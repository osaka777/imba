import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

import { OperationService } from '~/main/operation/operation.service';
import { PrismaService } from '~/prisma/prisma.service';

import { PaymentSignatureNotMatch } from '../exception/payment-signature-not-match';
import { PaymentSystemService } from '../payment-system.service';
import {
  CrocopayPaymentSystemCallbackDto,
  CrocopayPaymentSystemDepositDto,
  CrocopayPaymentSystemDepositResp,
} from './dto/crocopay-payment-system-deposit.dto';

@Injectable()
export class CrocoPayPaymentSystemService {
  private readonly api = axios.create({
    baseURL: this.configService.getOrThrow<string>('CROCOPAY_BASE_URL'),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  private readonly logger = new Logger(CrocoPayPaymentSystemService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentSystemService: PaymentSystemService,
    private readonly operationService: OperationService,
    private readonly prismaService: PrismaService,
  ) {}

  async callback(dto: CrocopayPaymentSystemCallbackDto, operationId: number) {
    this.logger.log(
      `Handling callback for operation #${operationId} with DTO: ${JSON.stringify(dto)}`,
    );

    const {
      charge_fixed,
      charge_percentage,
      percentage,
      sign,
      subtotal,
      timestamp,
      total,
    } = dto;

    const message = `${timestamp}|${subtotal}|${percentage}|${charge_percentage}|${charge_fixed}|${total}`;

    const hash = crypto
      .createHmac(
        'sha256',
        this.configService.getOrThrow<string>('CROCOPAY_SECRET'),
      )
      .update(message)
      .digest('hex');

    if (sign !== hash) {
      this.logger.error('Signature not match for operation #' + operationId);
      throw new PaymentSignatureNotMatch();
    }

    this.logger.log('Updating status for operation #' + operationId);
    await this.paymentSystemService.updateOperation(
      OperationStatus.SUCCESS,
      operationId,
    );
    this.logger.log('Updated status for operation #' + operationId);

    return {
      success: true,
      status: 'SUCCESS',
      operationId: operationId,
      amount: dto.total,
      message: 'Callback processed successfully'
    };
  }

  async deposite(dto: CrocopayPaymentSystemDepositDto, userId: number) {
    this.logger.log('Creating deposit for user ' + userId);
    try {
      const operation = await this.operationService.create(
        this.prismaService,
        userId,
        {
          amount: new Decimal(dto.amount),
          currencyCode: dto.currency,
          source: 'PAYMENT_SYSTEM',
          status: OperationStatus.WAITING,
          type: 'INCOME',
        },
      );
      this.logger.log(`Operation #${operation.id} created for ` + userId);
      const formData = new FormData();
      formData.append(
        'client_id',
        this.configService.getOrThrow<string>('CROCOPAY_CLIENT_ID'),
      );
      formData.append(
        'client_secret',
        this.configService.getOrThrow<string>('CROCOPAY_SECRET'),
      );
      formData.append('amount', dto.amount.toString());
      formData.append('currency', dto.currency);
      formData.append(
        'callbackUrl',
        `${this.configService.getOrThrow<string>(
          'CROCOPAY_CALLBACK_URL',
        )}?operationId=${operation.id}`,
      );
      formData.append(
        'cancelUrl',
        this.configService.getOrThrow<string>('CROCOPAY_CANCEL_URL'),
      );
      formData.append('curreny', dto.currency);
      formData.append(
        'successUrl',
        this.configService.getOrThrow<string>('CROCOPAY_SUCCESS_URL'),
      );
      const response = await this.api.post<CrocopayPaymentSystemDepositResp>(
        '/initiate-payment',
        formData,
      );
      this.logger.log('Payment link given for operation ' + operation.id);
      return response.data;
    } catch (e) {
      if (e instanceof AxiosError) {
        this.logger.error(
          `Error while creating deposit for user ${userId}: ${e.response?.data.message}`,
        );
        throw new BadRequestException(e.response?.data.message);
      } else {
        this.logger.error(
          `Unknown error while creating deposit for user ${userId}`,
        );
        throw new BadRequestException('Something went wrong');
      }
    }
  }
}
