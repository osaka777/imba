import { ApiProperty } from '@nestjs/swagger';
import {
  OperationSource,
  OperationStatus,
  OperationType,
  type Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';

export class CreateOperationDto extends Dto<CreateOperationDto> {
  @Type(() => String)
  @ApiProperty({ type: 'string' })
  amount: Decimal;
  currencyCode: string;
  meta?: Prisma.InputJsonValue;
  @ApiProperty({ enum: Object.values(OperationSource) })
  source: OperationSource;
  @ApiProperty({ enum: Object.values(OperationStatus) })
  status: OperationStatus;
  @ApiProperty({ enum: Object.values(OperationType) })
  type: OperationType;
}
