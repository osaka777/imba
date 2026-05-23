import { IsString, IsUUID } from 'class-validator';

export class AaioPaymentSystemDepositNotificationDto {
  amount: string;
  currency: string;
  invoice_id: string;
  merchant_id: string;
  method: string;
  order_id: string;
  profit: string;
  sign: string;
  status: string;
}

export class AaioPaymentSystemWithdrawNotificationDto {
  @IsUUID()
  id: string;

  @IsString()
  my_id: string;

  @IsString()
  sign: string;

  @IsString()
  status: 'cancel' | 'success';
}
