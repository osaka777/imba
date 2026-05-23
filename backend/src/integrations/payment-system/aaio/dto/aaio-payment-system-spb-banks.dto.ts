import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

class Bank {
  bankId: number;
  bankName: string;
}

@ApiExtraModels(Bank)
export class AaioPaymentSystemSpbBanksDto {
  @ApiProperty({
    example: [
      {
        bankId: 100000000199,
        bankName: 'ИШБАНК',
      },
    ],
  })
  list: Bank[];

  @ApiProperty({
    example: 'success',
  })
  type: string;
}
