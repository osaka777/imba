import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

class Operator {
  phoneId: string;
  phoneName: string;
}

@ApiExtraModels(Operator)
export class AaioPaymentSystemPhoneOperatorsDto {
  @ApiProperty({
    example: [
      {
        phoneId: 'beeline_ru',
        phoneName: 'Билайн',
      },
    ],
    items: {
      $ref: getSchemaPath(Operator),
    },
    type: 'array',
  })
  list: Operator[];

  @ApiProperty({
    example: 'success',
  })
  type: string;
}
