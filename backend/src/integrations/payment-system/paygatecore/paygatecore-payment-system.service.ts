import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepositStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import axios, { AxiosError } from 'axios';
import { createHmac, randomUUID } from 'node:crypto';

import { PaymentSignatureNotMatch } from '~/integrations/payment-system/exception/payment-signature-not-match';
import { DepositCreditService } from '~/main/deposit/deposit-credit.service';
import { createUniquePublicOrderId } from '~/main/deposit/deposit-public-order-id.util';
import { DepositService } from '~/main/deposit/deposit.service';
import { DepositUserNotifyService } from '~/main/deposit/deposit-user-notify.service';
import { isPaymentMethodEnabled } from '~/main/payment-settings/payment-settings.store';
import { PrismaService } from '~/prisma/prisma.service';

import {
  PayGateCoreCardTransactionResponse,
  PayGateCoreCreateDepositDto,
  PayGateCoreTransactionInfo,
  PayGateCoreWebhookPayload,
} from './dto/paygatecore-deposit.dto';

const SUCCESS_STATUSES = new Set(['paid', 'underpaid', 'overpaid']);
const FAILURE_STATUSES = new Set(['expired', 'cancel', 'error', 'chargeback']);

@Injectable()
export class PayGateCorePaymentSystemService {
  private readonly logger = new Logger(PayGateCorePaymentSystemService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly depositService: DepositService,
    private readonly depositCreditService: DepositCreditService,
    private readonly depositUserNotify: DepositUserNotifyService,
    private readonly prisma: PrismaService,
  ) {}

  assertEnabled() {
    if (!isPaymentMethodEnabled('PayGateCore')) {
      throw new BadRequestException('PayGateCore отключён');
    }
  }

  private getMinAmount(_currency: string): number {
    return Number(this.configService.get<string>('PAYGATECORE_MIN_AMOUNT_RUB') || 1000);
  }

  /** card | sbp | qr — P2P PayIn (не ecom/эквайринг) */
  private getPayinMethodPath(): string {
    const method = String(
      this.configService.get<string>('PAYGATECORE_PAYIN_METHOD') || 'sbp',
    )
      .toLowerCase()
      .trim();
    const allowed = new Set(['card', 'sbp', 'qr', 'account']);
    if (!allowed.has(method)) {
      return 'sbp';
    }
    return method;
  }

  private formatApiError(data: any): string {
    if (!data) return 'PayGateCore API error';
    const errors = data.errors;
    if (errors && typeof errors === 'object') {
      const parts: string[] = [];
      for (const [key, val] of Object.entries(errors)) {
        const text = Array.isArray(val) ? val.join('; ') : String(val);
        parts.push(`${key}: ${text}`);
      }
      if (parts.length) {
        const joined = parts.join(' | ');
        if (/not enabled/i.test(joined)) {
          return 'Метод оплаты не включён в ЛК PayGateCore. Попросите менеджера включить СБП или карту для RUB.';
        }
        return joined;
      }
    }
    return String(data.message || data.error || 'PayGateCore API error');
  }

  private getApi() {
    const baseURL = this.configService.get<string>('PAYGATECORE_BASE_URL');
    const token = this.configService.get<string>('PAYGATECORE_MERCHANT_TOKEN');
    if (!baseURL || !token) {
      throw new BadRequestException('PayGateCore не настроен на сервере');
    }
    return axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  verifyWebhookSignature(
    rawBody: string,
    pathWithQuery: string,
    signature: string | undefined,
  ) {
    const secret = this.configService.get<string>('PAYGATECORE_SECRET_KEY');
    if (!secret) {
      throw new BadRequestException('PayGateCore secret key is not configured');
    }
    if (!signature) {
      throw new PaymentSignatureNotMatch();
    }
    const expected = createHmac('sha256', secret)
      .update(rawBody + pathWithQuery)
      .digest('hex')
      .toLowerCase();
    if (expected !== String(signature).toLowerCase()) {
      this.logger.warn('PayGateCore webhook signature mismatch');
      throw new PaymentSignatureNotMatch();
    }
  }

  async createCardDeposit(userId: number, dto: PayGateCoreCreateDepositDto) {
    this.assertEnabled();

    const currency = dto.currency.toUpperCase();
    if (currency !== 'RUB') {
      throw new BadRequestException('PayGateCore доступен только для RUB');
    }

    // Resume existing P2P session instead of blocking with "active request" error.
    const active = await this.findActivePayGateCoreDeposit(userId);
    if (active) {
      return this.toCreateResponse(active);
    }

    const amount = Math.round(Number(dto.amount));
    const minAmount = this.getMinAmount(currency);
    if (!amount || amount < minAmount) {
      throw new BadRequestException(
        `Минимальная сумма пополнения ${minAmount} ${currency}`,
      );
    }

    const merchantTransactionId = randomUUID();
    const publicOrderId = await createUniquePublicOrderId(this.prisma);
    const webhookUrl = this.configService.get<string>('PAYGATECORE_WEBHOOK_URL');
    const payinMethod = this.getPayinMethodPath();

    const depositMeta: Record<string, unknown> = {
      lifecycle: 'INITIATED',
      initiatedSource: dto.source || 'paygatecore-modal',
      initiatedAt: new Date().toISOString(),
      publicOrderId,
      paygatecore: {
        merchantTransactionId,
        method: payinMethod,
      },
    };
    if (dto.voucher?.trim()) {
      depositMeta.voucher = dto.voucher.trim();
    }

    const deposit = await this.depositService.createDeposit({
      userId,
      externalId: merchantTransactionId,
      paymentSystem: 'PayGateCore',
      amount: new Decimal(amount),
      currencyCode: currency,
      meta: depositMeta,
    });

    try {
      const api = this.getApi();
      const { data } = await api.post<PayGateCoreCardTransactionResponse>(
        `/api/v1/transactions/${payinMethod}`,
        {
          amount: String(amount),
          currency,
          merchant_transaction_id: merchantTransactionId,
          client_id: String(userId),
          ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
        },
      );

      const paymentLink =
        data.payment_link ||
        (data as { payment_url?: string }).payment_url ||
        undefined;

      const oldMeta = (deposit.meta as Record<string, unknown>) || {};
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.PROCESSING,
          meta: {
            ...oldMeta,
            paygatecore: {
              ...(oldMeta.paygatecore as Record<string, unknown>),
              id: data.id,
              method: payinMethod,
              expiresAt: data.expires_at,
              requisites: {
                cardNumber: data.card_number,
                ownerName: data.owner_name,
                bankName: data.bank_name,
                phoneNumber: data.phone_number,
                paymentLink,
                countryName: data.country_name,
              },
            },
          } as any,
        },
      });

      return {
        ok: true,
        resumed: false,
        depositId: deposit.id,
        publicOrderId,
        amount,
        currency,
        expiresAt: data.expires_at,
        method: payinMethod,
        requisites: {
          cardNumber: data.card_number,
          ownerName: data.owner_name,
          bankName: data.bank_name,
          phoneNumber: data.phone_number,
          paymentLink,
          countryName: data.country_name,
        },
        paygatecoreId: data.id,
      };
    } catch (error) {
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.FAILED,
          meta: {
            ...(deposit.meta as Record<string, unknown>),
            error:
              error instanceof AxiosError
                ? error.response?.data
                : (error as Error).message,
          } as any,
        },
      });

      if (error instanceof AxiosError) {
        throw new BadRequestException(this.formatApiError(error.response?.data));
      }
      throw error;
    }
  }

  async getActiveCardDeposit(userId: number) {
    this.assertEnabled();
    const active = await this.findActivePayGateCoreDeposit(userId);
    if (!active) {
      return { ok: true, active: false as const };
    }
    return {
      ok: true,
      active: true as const,
      ...this.toCreateResponse(active),
    };
  }

  private async findActivePayGateCoreDeposit(userId: number) {
    return this.prisma.deposit.findFirst({
      where: {
        userId,
        paymentSystem: 'PayGateCore',
        status: { in: [DepositStatus.PENDING, DepositStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toCreateResponse(deposit: {
    id: number;
    amount: Decimal;
    currencyCode: string;
    meta: unknown;
  }) {
    const meta = (deposit.meta as Record<string, unknown>) || {};
    const paygatecore = (meta.paygatecore as Record<string, unknown>) || {};
    const requisites =
      (paygatecore.requisites as Record<string, unknown> | undefined) || {};
    return {
      ok: true,
      resumed: true,
      depositId: deposit.id,
      publicOrderId: Number(meta.publicOrderId) || deposit.id,
      amount: Number(deposit.amount),
      currency: deposit.currencyCode,
      expiresAt: (paygatecore.expiresAt as string | undefined) || undefined,
      method: (paygatecore.method as string | undefined) || this.getPayinMethodPath(),
      requisites: {
        cardNumber: requisites.cardNumber as string | undefined,
        ownerName: requisites.ownerName as string | undefined,
        bankName: requisites.bankName as string | undefined,
        phoneNumber: requisites.phoneNumber as string | undefined,
        paymentLink: requisites.paymentLink as string | undefined,
        countryName: requisites.countryName as string | undefined,
      },
      paygatecoreId: paygatecore.id as number | undefined,
    };
  }

  async getDepositStatus(userId: number, depositId: number) {
    this.assertEnabled();

    const deposit = await this.prisma.deposit.findFirst({
      where: {
        id: depositId,
        userId,
        paymentSystem: 'PayGateCore',
      },
    });
    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    const meta = (deposit.meta as Record<string, unknown>) || {};
    const paygatecore = (meta.paygatecore as Record<string, unknown>) || {};
    const paygatecoreId = paygatecore.id as number | undefined;

    let remote: PayGateCoreTransactionInfo | null = null;
    if (
      paygatecoreId &&
      (deposit.status === DepositStatus.PENDING ||
        deposit.status === DepositStatus.PROCESSING)
    ) {
      remote = await this.fetchTransactionInfo(paygatecoreId);
      if (remote?.status && remote.status !== 'process') {
        await this.applyRemoteStatus(deposit.id, remote);
      }
    }

    const refreshed = await this.prisma.deposit.findUnique({
      where: { id: deposit.id },
    });

    return {
      depositId: refreshed!.id,
      publicOrderId: meta.publicOrderId,
      amount: Number(refreshed!.amount),
      currency: refreshed!.currencyCode,
      status: this.mapDepositStatus(refreshed!.status),
      expiresAt: paygatecore.expiresAt,
      requisites: (paygatecore.requisites as Record<string, unknown>) || null,
      paygatecoreStatus: remote?.status,
      paidAmount: remote?.paid_amount ? Number(remote.paid_amount) : undefined,
    };
  }

  async cancelDeposit(userId: number, depositId: number) {
    this.assertEnabled();

    const deposit = await this.prisma.deposit.findFirst({
      where: {
        id: depositId,
        userId,
        paymentSystem: 'PayGateCore',
        status: { in: [DepositStatus.PENDING, DepositStatus.PROCESSING] },
      },
    });
    if (!deposit) {
      return { ok: true, cancelled: false };
    }

    const meta = (deposit.meta as Record<string, unknown>) || {};
    const paygatecoreId = (meta.paygatecore as Record<string, unknown>)?.id as
      | number
      | undefined;

    if (paygatecoreId) {
      try {
        const api = this.getApi();
        await api.post(`/api/v1/transactions/${paygatecoreId}/cancel`);
      } catch (error) {
        if (error instanceof AxiosError) {
          this.logger.warn(
            `PayGateCore cancel failed for deposit ${depositId}: ${JSON.stringify(error.response?.data)}`,
          );
        }
      }
    }

    await this.prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        status: DepositStatus.CANCELLED,
        meta: {
          ...meta,
          userCancelled: true,
          lifecycle: 'CANCELLED_BY_USER',
          cancelledAt: new Date().toISOString(),
        } as any,
      },
    });

    return { ok: true, cancelled: true, depositId: deposit.id };
  }

  async handleWebhook(
    rawBody: string,
    pathWithQuery: string,
    signature: string | undefined,
    payload: PayGateCoreWebhookPayload,
  ) {
    this.verifyWebhookSignature(rawBody, pathWithQuery, signature);

    const deposit = await this.prisma.deposit.findUnique({
      where: { externalId: payload.merchant_transaction_id },
    });
    if (!deposit) {
      this.logger.warn(
        `PayGateCore webhook: deposit not found for ${payload.merchant_transaction_id}`,
      );
      return { ok: false, reason: 'deposit_not_found' };
    }

    if (deposit.paymentSystem !== 'PayGateCore') {
      return { ok: false, reason: 'invalid_payment_system' };
    }

    await this.applyRemoteStatus(deposit.id, payload);
    return { ok: true };
  }

  private async fetchTransactionInfo(
    paygatecoreId: number,
  ): Promise<PayGateCoreTransactionInfo | null> {
    try {
      const api = this.getApi();
      const { data } = await api.get<PayGateCoreTransactionInfo>(
        `/api/v1/transactions/${paygatecoreId}`,
      );
      return data;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch PayGateCore transaction ${paygatecoreId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async applyRemoteStatus(
    depositId: number,
    remote: PayGateCoreTransactionInfo | PayGateCoreWebhookPayload,
  ) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) return;

    if (
      deposit.status !== DepositStatus.PENDING &&
      deposit.status !== DepositStatus.PROCESSING
    ) {
      return;
    }

    const status = remote.status;
    if (!status) return;

    const oldMeta = (deposit.meta as Record<string, unknown>) || {};
    const callbackMeta = {
      paygatecoreCallback: remote,
      callbackAt: new Date().toISOString(),
    };

    if (SUCCESS_STATUSES.has(status)) {
      const paidAmount = new Decimal(remote.paid_amount || remote.amount);
      if (!paidAmount.equals(deposit.amount)) {
        await this.prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            amount: paidAmount,
            callbackData: remote as any,
            meta: { ...oldMeta, ...callbackMeta } as any,
          },
        });
      } else {
        await this.prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            callbackData: remote as any,
            meta: { ...oldMeta, ...callbackMeta } as any,
          },
        });
      }
      await this.depositCreditService.creditDeposit(deposit.id, callbackMeta);
      return;
    }

    if (status === 'process') {
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.PROCESSING,
          callbackData: remote as any,
          meta: { ...oldMeta, ...callbackMeta } as any,
        },
      });
      return;
    }

    if (FAILURE_STATUSES.has(status)) {
      const newStatus =
        status === 'cancel' ? DepositStatus.CANCELLED : DepositStatus.FAILED;
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: newStatus,
          callbackData: remote as any,
          meta: {
            ...oldMeta,
            ...callbackMeta,
            lifecycle: status === 'expired' ? 'EXPIRED' : 'FAILED',
          } as any,
        },
      });

      const publicOrderId =
        (oldMeta.publicOrderId as number | undefined) ?? deposit.id;
      this.depositUserNotify.notifyDepositStatus({
        userId: deposit.userId,
        orderId: deposit.id,
        publicOrderId,
        status: status === 'expired' ? 'expired' : 'rejected',
        amount: Number(deposit.amount),
        currency: deposit.currencyCode,
      });
    }
  }

  private mapDepositStatus(status: DepositStatus): string {
    switch (status) {
      case DepositStatus.SUCCESS:
        return 'approved';
      case DepositStatus.FAILED:
      case DepositStatus.CANCELLED:
        return 'rejected';
      case DepositStatus.PROCESSING:
        return 'processing';
      default:
        return 'pending';
    }
  }
}
