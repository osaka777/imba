import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '~/prisma/prisma.service';
import { DepositCreditService } from './deposit-credit.service';
import {
  TRONGRID_API_BASE,
  USDT_TRC20_CONTRACT,
  USDT_TRC20_WALLET_DEFAULT,
} from './usdt-trc20.constants';
import { amountsMatch, sunToUsdt } from './usdt-trc20.util';
import { getManualDepositFromSettings } from '../payment-settings/payment-settings.store';

type TronTrc20Tx = {
  transaction_id?: string;
  block_timestamp?: number;
  to?: string;
  value?: string;
  token_info?: { address?: string; symbol?: string };
};

@Injectable()
export class UsdtTrc20MonitorService {
  private readonly logger = new Logger(UsdtTrc20MonitorService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly depositCredit: DepositCreditService,
  ) {}

  private getWalletAddress(): string {
    const config = getManualDepositFromSettings('USDT');
    return (
      config.walletAddress?.trim() ||
      config.cardNumber?.trim() ||
      process.env.USDT_TRC20_WALLET ||
      USDT_TRC20_WALLET_DEFAULT
    );
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollIncomingTransfers() {
    if (this.processing) return;
    this.processing = true;
    try {
      const pending = await this.prisma.deposit.findMany({
        where: {
          paymentSystem: 'USDT_TRC20',
          status: { in: ['PENDING', 'PROCESSING'] as any },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      if (pending.length === 0) return;

      const wallet = this.getWalletAddress();
      const txs = await this.fetchRecentIncoming(wallet);
      if (txs.length === 0) return;

      const usedTxHashes = await this.getUsedTxHashes();

      for (const depo of pending) {
        const meta = (depo.meta as Record<string, unknown>) || {};
        const payAmount = Number(meta.payAmount);
        if (!payAmount || Number.isNaN(payAmount)) continue;

        const createdAtMs = new Date(depo.createdAt).getTime();
        const expiresMs =
          Number(meta.expiresInMinutes) > 0
            ? Number(meta.expiresInMinutes) * 60 * 1000
            : 45 * 60 * 1000;
        const match = txs.find((tx) => {
          const txHash = tx.transaction_id;
          if (!txHash || usedTxHashes.has(txHash)) return false;
          if (!tx.block_timestamp) return false;
          if (tx.block_timestamp < createdAtMs) return false;
          if (tx.block_timestamp > createdAtMs + expiresMs) return false;
          const amount = sunToUsdt(tx.value || '0');
          return amountsMatch(payAmount, amount);
        });

        if (!match?.transaction_id) continue;

        const txHash = match.transaction_id;
        try {
          await this.depositCredit.creditDeposit(depo.id, {
            txHash,
            matchedAt: new Date().toISOString(),
            lifecycle: 'CREDITED',
            onChainAmount: sunToUsdt(match.value || '0'),
          });
          usedTxHashes.add(txHash);
          this.logger.log(
            `USDT TRC-20 credited deposit #${depo.id} tx=${txHash} amount=${payAmount}`,
          );
        } catch (error) {
          this.logger.error(`Failed to credit USDT deposit #${depo.id}`, error as Error);
        }
      }
    } catch (error) {
      this.logger.error('USDT TRC-20 poll failed', error as Error);
    } finally {
      this.processing = false;
    }
  }

  private async getUsedTxHashes(): Promise<Set<string>> {
    const credited = await this.prisma.deposit.findMany({
      where: {
        paymentSystem: 'USDT_TRC20',
        status: 'SUCCESS',
      },
      select: { meta: true },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    });
    const hashes = new Set<string>();
    for (const row of credited) {
      const txHash = (row.meta as any)?.txHash;
      if (txHash) hashes.add(String(txHash));
    }
    return hashes;
  }

  private async fetchRecentIncoming(wallet: string): Promise<TronTrc20Tx[]> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = process.env.TRONGRID_API_KEY?.trim();
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const url = `${TRONGRID_API_BASE}/v1/accounts/${wallet}/transactions/trc20?only_to=true&limit=50&contract_address=${USDT_TRC20_CONTRACT}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      this.logger.warn(`TronGrid responded ${res.status} for wallet ${wallet}`);
      return [];
    }
    const json = (await res.json()) as { data?: TronTrc20Tx[] };
    return (json.data || []).filter(
      (tx) =>
        tx.token_info?.symbol === 'USDT' ||
        tx.token_info?.address === USDT_TRC20_CONTRACT,
    );
  }
}
