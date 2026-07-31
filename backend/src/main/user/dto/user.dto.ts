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

  phone?: string | null;

  phoneVerifiedAt?: Date | null;

  phoneVerified?: boolean;

  id: number;

  telegramUsername?: string | null;

  telegramLinkedAt?: Date | null;

  telegramLinked?: boolean;

  telegramNotifyDeposit?: boolean;

  telegramNotifyWithdraw?: boolean;

  telegramNotifyBets?: boolean;

  telegramNotifyPromo?: boolean;

  telegram2faEnabled?: boolean;

  avatarPreset?: string | null;

  avatarUrl?: string | null;

  nickname?: string | null;

  @Exclude()
  password: string;
  updatedAt: Date;
}
