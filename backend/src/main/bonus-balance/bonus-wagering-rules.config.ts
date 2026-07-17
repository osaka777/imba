/** Правила отыгрыша бонуса — заточены под удержание депозита и сгорание бонуса */
export const BONUS_WAGERING_RULES = {
  /** Только ординар, без экспресса */
  allowExpress: false,
  /** Только исход (1X2) и тоталы */
  allowedMarketKeys: ['h2h', 'totals', 'totals_home', 'totals_away'] as const,
  /** Мин. кэф выше среднего — сложнее «дожимать» вейджер мелкими кэфами */
  minOdds: 1.85,
  /** Высокие кэфы — реже выигрыш, сложнее отыграть */
  maxOdds: 5,
  /** Не более N% бонусного баланса за одну ставку */
  maxBetPercentOfBalance: 15,
  /** Live и прематч — исход и тотал */
  allowLive: true,
};
