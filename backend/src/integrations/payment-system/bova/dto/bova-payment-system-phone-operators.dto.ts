import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

class Operator {
  phoneId: string;
  phoneName: string;
}

@ApiExtraModels(Operator)
export class BovaPaymentSystemPhoneOperatorsDto {
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
