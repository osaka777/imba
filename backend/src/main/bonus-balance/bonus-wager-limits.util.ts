import { HttpException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { BONUS_WAGERING_RULES } from './bonus-wagering-rules.config';

export function assertBonusOddsInRange(
  odds: number | string,
  minOdds: Decimal | number | string,
): void {
  const oddsDec = new Decimal(odds);
  const minDec = new Decimal(minOdds);

  if (oddsDec.lessThan(minDec)) {
    throw new HttpException(
      { message: `Минимальный коэффициент для бонусных ставок: ${minDec}` },
      400,
    );
  }

  const maxOdds = BONUS_WAGERING_RULES.maxOdds;
  if (maxOdds != null && oddsDec.greaterThan(maxOdds)) {
    throw new HttpException(
      { message: `Максимальный коэффициент для бонусных ставок: ${maxOdds}` },
      400,
    );
  }
}

export function assertBonusStakeWithinLimit(
  stakeNum: number,
  bonusAmount: Decimal,
): void {
  const pct = BONUS_WAGERING_RULES.maxBetPercentOfBalance;
  if (pct == null || pct <= 0) return;

  const maxStake = bonusAmount.mul(pct).div(100);
  if (new Decimal(stakeNum).greaterThan(maxStake)) {
    throw new HttpException(
      {
        message: `Максимальная ставка с бонуса — ${pct}% от баланса (${maxStake.toFixed(2)})`,
      },
      400,
    );
  }
}
