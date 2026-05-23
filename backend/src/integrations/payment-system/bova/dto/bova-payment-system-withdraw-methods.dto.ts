import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

class Method {
  commission_percent: number;
  commission_sum: number;
  max: number;
  min: number;
  name: string;
}

@ApiExtraModels(Method)
export class BovaPaymentSystemWithdrawMethodsDto {
  @ApiProperty({
    additionalProperties: {
      $ref: getSchemaPath(Method),
    },
    example: {
      tether_trc20: {
        commission_percent: 3,
        commission_sum: 0,
        max: 40000,
        min: 500,
        name: 'Tether TRC-20',
      },
    },
    type: 'object',
  })
  list: {
    [name: string]: Method;
  };

  @ApiProperty({ example: 'success' })
  type: string;
}
