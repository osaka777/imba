export class BovaPaymentSystemDepositNotificationDto {
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

export class BovaPaymentSystemWithdrawNotificationDto {
  merchant_id: string;
  status: string;
}
