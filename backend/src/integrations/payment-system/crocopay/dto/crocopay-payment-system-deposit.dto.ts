import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class CrocopayPaymentSystemDepositDto {
  @IsNumber()
  @ApiProperty({ example: 1000 })
  amount: number;
  @IsString()
  @ApiProperty({ example: 'RUB' })
  currency: string;
}

export class CrocopayPaymentSystemCallbackDto {
  charge_fixed: string;
  charge_percentage: string;
  percentage: string;
  sign: string;
  subtotal: string;
  timestamp: string;
  total: string;
}

export type CrocopayPaymentSystemDepositSuccessResp = {
  message: string;
  redirect_url: string;
  status: 'success';
};

export type CrocopayPaymentSystemDepositFailResp = {
  message: string;
  status: 'error';
};

export type CrocopayPaymentSystemDepositResp =
  | CrocopayPaymentSystemDepositFailResp
  | CrocopayPaymentSystemDepositSuccessResp;
