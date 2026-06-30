import { Decimal } from '@prisma/client/runtime/library';

export class PaymentSystemWithdrawDto {
  amount: Decimal;
  currency: string;
  userId: number;
  method: string;
  wallet?: string;
  meta?: Record<string, unknown>;
}
