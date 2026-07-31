import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayGateCoreCreateDepositDto {
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'RUB', enum: ['RUB'] })
  @IsString()
  @IsIn(['RUB'])
  currency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voucher?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export interface PayGateCoreCardTransactionResponse {
  id: number;
  merchant_transaction_id: string;
  expires_at: string;
  amount: string;
  currency: string;
  currency_rate?: string;
  amount_in_usd?: string;
  rate?: string;
  commission?: string;
  card_number?: string;
  phone_number?: string;
  owner_name?: string;
  bank_name?: string;
  country_name?: string;
  payment_link?: string;
}

export interface PayGateCoreTransactionInfo extends PayGateCoreCardTransactionResponse {
  created_at?: string;
  updated_at?: string;
  type?: string;
  payment_method?: string;
  paid_amount?: string;
  status?: PayGateCoreTransactionStatus;
  paid_at?: string | null;
}

export type PayGateCoreTransactionStatus =
  | 'process'
  | 'paid'
  | 'underpaid'
  | 'overpaid'
  | 'expired'
  | 'cancel'
  | 'error'
  | 'chargeback';

export interface PayGateCoreWebhookPayload {
  id: number;
  merchant_transaction_id: string;
  type: string;
  amount: string;
  paid_amount: string;
  currency: string;
  currency_rate?: string;
  amount_in_usd?: string;
  status: PayGateCoreTransactionStatus;
}
