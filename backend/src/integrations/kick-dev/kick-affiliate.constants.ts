/** Бонус партнёру за первое подключение Kick-канала. */
export const KICK_CONNECT_BONUS_USD = 10;

/** Валюта Kick-программы в партнёрском кабинете. */
export const KICK_PARTNER_CURRENCY = 'USD';

export const KICK_CONNECT_BONUS_TYPE = 'kick_connect_activation' as const;

export const KICK_WEEKLY_CHALLENGE_GOAL = 5;
export const KICK_WEEKLY_CHALLENGE_BONUS_USD = 15;
export const KICK_WEEKLY_CHALLENGE_TYPE = 'kick_weekly_challenge' as const;

export const KICK_STREAM_RACE_GOAL = 10;
export const KICK_STREAM_RACE_BONUS_USD = 20;
export const KICK_STREAM_RACE_TYPE = 'kick_stream_race' as const;

/** Серия эфиров с imba-брендингом подряд. */
export const KICK_STREAK_GOAL = 3;
export const KICK_STREAK_BONUS_USD = 10;
export const KICK_STREAK_TYPE = 'kick_branding_streak' as const;

/** Спринт месяца: лучший канал по Kick-регистрациям. */
export const KICK_MONTH_SPRINT_BONUS_USD = 100;
export const KICK_MONTH_SPRINT_MIN_REGS = 10;
export const KICK_MONTH_SPRINT_TYPE = 'kick_month_sprint' as const;

export const KICK_VIEWER_OFFER_HEADLINE = 'Бонус на первый депозит по промокоду стримера';

/** @deprecated используйте KICK_CONNECT_BONUS_USD */
export const KICK_REGISTRATION_BONUS_USD = KICK_CONNECT_BONUS_USD;
