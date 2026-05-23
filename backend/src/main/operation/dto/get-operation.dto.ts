import { ApiProperty } from '@nestjs/swagger';
import { OperationType, OperationSource, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';

export class OperationDto extends Dto<OperationDto> {
  @Type(() => String)
  @ApiProperty({ type: 'string' })
  amount: Decimal;
  createdAt: Date;

  currencyCode: string;
  id: number;
  @ApiProperty({ enum: Object.values(OperationType) })
  type: OperationType;
  updatedAt: Date;
  userId: number;
  
  @ApiProperty({ enum: Object.values(OperationSource) })
  source: OperationSource;
  
  @ApiProperty({ type: 'object', nullable: true })
  meta: Prisma.JsonValue;
}
