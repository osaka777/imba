import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GreengoPaymentSystemDepositDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100.5 })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'USD' })
  currency: string;
}

export class GreengoPaymentSystemDepositResp {
  items: {
    amount_payable: string;
    order_id: string;
    wallet_payment: string;
  }[];
  response: string;
}
