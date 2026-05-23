import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { Exclude, Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';

export class BalanceDto extends Dto<BalanceDto> {
  @Type(() => String)
  @ApiProperty({ type: 'string' })
  amount: Decimal;
  @Exclude()
  createdAt: Date;
  currencyCode: string;
  id: number;
  @Exclude()
  updatedAt: Date;
  userId: number;
}
