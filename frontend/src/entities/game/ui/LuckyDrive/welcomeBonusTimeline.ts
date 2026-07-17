import {
  formatBonusTimeLeft,
  getWagerProgressPercent,
  isBonusExpired,
} from "~/entities/user/lib/bonusExpiry";

import { formatWelcomeMoney, getWelcomeLimit } from "./welcomeBonusLimits";

export type WelcomeBonusSnapshot = {
  currencyCode: string;
  amount: string;
  totalWagered: string;
  requiredWager: string;
  isActive: boolean;
  requiresDeposit?: boolean;
  depositActivated?: boolean;
  expiresAt?: string | null;
};

export type TimelineStepStatus = "done" | "current" | "upcoming" | "expired";

export type WelcomeTimelineStep = {
  n: number;
  title: string;
  text: string;
  status: TimelineStepStatus;
  actionLabel?: string;
};

export type WelcomeTimelineState = {
  currentStep: number;
  progressPct: number;
  headline: string;
  subline: string;
  ctaLabel: string;
  steps: WelcomeTimelineStep[];
  timeLeft: string | null;
  wagerPct: number;
};

const BASE_STEPS = [
  {
    n: 1,
    title: "Регистрация",
    text: "Выбери валюту — welcome появится в профиле",
    doneText: "Аккаунт создан, бонус ждёт вас",
  },
  {
    n: 2,
    title: "Пополнение",
    text: "Внеси депозит от минимума в течение 24 ч",
    doneText: "Депозит зачислен на основной счёт",
  },
  {
    n: 3,
    title: "Активация",
    text: "40% бонусом на бонусный счёт",
    doneText: "Бонус начислен — можно ставить",
  },
  {
    n: 4,
    title: "Отыгрыш",
    text: "Ставь с бонуса на исход или тотал до вейджера ×8",
    doneText: "Вейджер выполнен — вывод доступен",
  },
] as const;

function buildSteps(
  current: number,
  expiredStep: number | null,
): WelcomeTimelineStep[] {
  return BASE_STEPS.map((step) => {
    let status: TimelineStepStatus = "upcoming";
    if (expiredStep === step.n) status = "expired";
    else if (step.n < current) status = "done";
    else if (step.n === current) status = "current";

    const text =
      status === "done" ? step.doneText
      : status === "expired" ? "Срок истёк — бонус сгорел"
      : step.text;

    return {
      n: step.n,
      title: step.title,
      text,
      status,
      actionLabel: status === "current" ? "Сейчас ваш шаг" : undefined,
    };
  });
}

export function resolveWelcomeTimeline(params: {
  isAuthenticated: boolean;
  bonus?: WelcomeBonusSnapshot | null;
  currency: string;
}): WelcomeTimelineState {
  const { isAuthenticated, bonus, currency } = params;
  const limit = getWelcomeLimit(currency);
  const minDeposit = formatWelcomeMoney(limit.minDeposit, limit.currency);
  const maxBonus = formatWelcomeMoney(limit.maxBonus, limit.currency);
  const timeLeft = formatBonusTimeLeft(bonus?.expiresAt);
  const wagerPct = getWagerProgressPercent(bonus?.totalWagered, bonus?.requiredWager);
  const expired = bonus ? isBonusExpired(bonus.expiresAt) : false;

  if (!isAuthenticated) {
    return {
      currentStep: 1,
      progressPct: 8,
      headline: "Шаг 1 из 4 — регистрация",
      subline: "Создай аккаунт за минуту — welcome-бонус сразу появится в профиле",
      ctaLabel: "Зарегистрироваться",
      steps: buildSteps(1, null),
      timeLeft: null,
      wagerPct: 0,
    };
  }

  const locked = Boolean(
    bonus?.requiresDeposit && !bonus?.depositActivated && !expired,
  );
  const wagering = Boolean(
    bonus?.depositActivated
    && bonus?.isActive
    && Number(bonus.requiredWager) > 0
    && Number(bonus.totalWagered) < Number(bonus.requiredWager)
    && !expired,
  );
  const completed = Boolean(
    bonus?.depositActivated
    && Number(bonus.requiredWager) > 0
    && Number(bonus.totalWagered) >= Number(bonus.requiredWager),
  );

  if (expired && bonus?.requiresDeposit && !bonus.depositActivated) {
    return {
      currentStep: 2,
      progressPct: 25,
      headline: "Время вышло",
      subline: "Депозит не внесён вовремя — welcome-бонус сгорел",
      ctaLabel: "В профиль",
      steps: buildSteps(2, 2),
      timeLeft: "истёк",
      wagerPct: 0,
    };
  }

  if (expired && bonus?.depositActivated) {
    return {
      currentStep: 4,
      progressPct: 75,
      headline: "Срок отыгрыша истёк",
      subline: "Бонус не отыгран вовремя — остаток сгорел",
      ctaLabel: "В профиль",
      steps: buildSteps(4, 4),
      timeLeft: "истёк",
      wagerPct,
    };
  }

  if (completed) {
    return {
      currentStep: 5,
      progressPct: 100,
      headline: "Готово — бонус отыгран!",
      subline: "Вывод выигрыша с бонуса — до 1.5× суммы депозита",
      ctaLabel: "В профиль",
      steps: buildSteps(5, null),
      timeLeft: null,
      wagerPct: 100,
    };
  }

  if (wagering) {
    const remaining = 100 - wagerPct;
    return {
      currentStep: 4,
      progressPct: 62 + Math.round(wagerPct * 0.38),
      headline: `Шаг 4 из 4 — осталось ${remaining}% вейджера`,
      subline: timeLeft
        ? `Ставь с бонусного счёта · сгорит через ${timeLeft}`
        : "Ставь с бонусного счёта на исход или тотал",
      ctaLabel: "Перейти к ставкам",
      steps: buildSteps(4, null),
      timeLeft,
      wagerPct,
    };
  }

  if (locked) {
    return {
      currentStep: 2,
      progressPct: 28,
      headline: "Шаг 2 из 4 — пополнение",
      subline: timeLeft
        ? `Пополни от ${minDeposit} — получи до ${maxBonus} бонусом · осталось ${timeLeft}`
        : `Пополни от ${minDeposit} — получи до ${maxBonus} бонусом`,
      ctaLabel: `Пополнить от ${minDeposit}`,
      steps: buildSteps(2, null),
      timeLeft,
      wagerPct: 0,
    };
  }

  if (bonus?.depositActivated) {
    return {
      currentStep: 4,
      progressPct: 55,
      headline: "Шаг 4 из 4 — начни отыгрыш",
      subline: `Бонус ${bonus.amount} ${currency} на счёте — сделай первую ставку`,
      ctaLabel: "Сделать ставку",
      steps: buildSteps(4, null),
      timeLeft,
      wagerPct: 0,
    };
  }

  return {
    currentStep: 2,
    progressPct: 22,
    headline: "Шаг 2 из 4 — пополнение",
    subline: `Пополни от ${minDeposit} и активируй welcome до ${maxBonus}`,
    ctaLabel: `Пополнить от ${minDeposit}`,
    steps: buildSteps(2, null),
    timeLeft,
    wagerPct: 0,
  };
}
