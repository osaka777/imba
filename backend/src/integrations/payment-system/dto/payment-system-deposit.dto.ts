import { Decimal } from '@prisma/client/runtime/library';

export class PaymentSystemDepositDto {
  amount: Decimal;
  currency: string;
  userId: number;
}
