import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

class Bank {
  id: string;
  name: string;
}

@ApiExtraModels(Bank)
export class BovaPaymentSystemSpbBanksDto {
  @ApiProperty({
    example: [
      {
        id: '100000000199',
        name: 'ИШБАНК',
      },
    ],
  })
  list: Bank[];

  @ApiProperty({
    example: 'success',
  })
  type: string;
}
