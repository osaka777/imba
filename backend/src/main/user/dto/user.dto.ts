import { Exclude, Type } from 'class-transformer';

import { Dto } from '~/common/types/dto';
import { BalanceDto } from '~/main/operation/dto/get-balance.dto';
import { BonusBalanceDto } from './bonus-balance.dto';

export class UserDto extends Dto<UserDto> {
  @Exclude()
  affiliatedById: number;

  @Type(() => BalanceDto)
  balances?: BalanceDto[];

  @Type(() => BonusBalanceDto)
  bonusBalances?: BonusBalanceDto[];

  createdAt: Date;

  email: string;

  id: number;

  @Exclude()
  password: string;
  updatedAt: Date;
}
