import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { Exclude, Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';

export class BonusBalanceDto extends Dto<BonusBalanceDto> {
  @Type(() => String)
  @ApiProperty({ type: 'string' })
  amount: Decimal;

  @Type(() => String)
  @ApiProperty({ type: 'string' })
  totalBonusReceived: Decimal;

  @Type(() => String)
  @ApiProperty({ type: 'string' })
  totalWagered: Decimal;

  @Type(() => String)
  @ApiProperty({ type: 'string' })
  requiredWager: Decimal;

  @Type(() => String)
  @ApiProperty({ type: 'string' })
  minOdds: Decimal;

  @ApiProperty()
  consecutiveWins: number;

  @ApiProperty()
  requiredConsecutiveWins: number;

  @Type(() => String)
  @ApiProperty({ type: 'string' })
  currentBetAmount: Decimal;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  totalTokens: number;

  @ApiProperty()
  remainingTokens: number;

  @ApiProperty()
  tokensPerBet: number;

  @ApiProperty()
  isTokenBased: boolean;

  @ApiProperty({ required: false })
  promoId?: number;

  @Exclude()
  createdAt: Date;

  @Exclude()
  updatedAt: Date;

  @Exclude()
  userId: number;

  @Exclude()
  currencyCode: string;
} 