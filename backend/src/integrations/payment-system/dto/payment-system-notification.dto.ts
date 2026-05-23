import { Decimal } from '@prisma/client/runtime/library';
import { IsDecimal, IsString, IsUUID } from 'class-validator';

export class PaymentSystemDepositNotificationDto {
  @IsDecimal()
  amount: Decimal;

  @IsString()
  currency: string;

  @IsUUID()
  invoice_id: string;

  @IsUUID()
  merchant_id: string;

  @IsString()
  method: string;

  @IsString()
  order_id: string;

  @IsDecimal()
  profit: Decimal;

  @IsString()
  sign: string;
}

export class PaymentSystemWithdrawNotificationDto {
  @IsUUID()
  id: string;

  @IsString()
  my_id: string;

  @IsString()
  sign: string;

  @IsString()
  status: 'cancel' | 'success';
}
