import {
  formatBonusTimeLeft,
  getWagerProgressPercent,
  isBonusExpired,
} from "~/entities/user/lib/bonusExpiry";
import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";

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

export type WelcomeCtaAction = "register" | "deposit" | "bets" | "profile";

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
  ctaAction: WelcomeCtaAction;
  steps: WelcomeTimelineStep[];
  timeLeft: string | null;
  timeExpired: boolean;
  wagerPct: number;
};

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

const STEP_KEYS = [
  {
    n: 1,
    title: "promo.tlStep1Title",
    text: "promo.tlStep1Text",
    doneText: "promo.tlStep1Done",
  },
  {
    n: 2,
    title: "promo.tlStep2Title",
    text: "promo.tlStep2Text",
    doneText: "promo.tlStep2Done",
  },
  {
    n: 3,
    title: "promo.tlStep3Title",
    text: "promo.tlStep3Text",
    doneText: "promo.tlStep3Done",
  },
  {
    n: 4,
    title: "promo.tlStep4Title",
    text: "promo.tlStep4Text",
    doneText: "promo.tlStep4Done",
  },
] as const satisfies ReadonlyArray<{
  n: number;
  title: MessageKey;
  text: MessageKey;
  doneText: MessageKey;
}>;

function buildSteps(
  current: number,
  expiredStep: number | null,
  t: TranslateFn,
): WelcomeTimelineStep[] {
  return STEP_KEYS.map((step) => {
    let status: TimelineStepStatus = "upcoming";
    if (expiredStep === step.n) status = "expired";
    else if (step.n < current) status = "done";
    else if (step.n === current) status = "current";

    const text =
      status === "done"
        ? t(step.doneText)
        : status === "expired"
          ? t("promo.tlStepExpired")
          : t(step.text);

    return {
      n: step.n,
      title: t(step.title),
      text,
      status,
      actionLabel: status === "current" ? t("promo.tlCurrentStep") : undefined,
    };
  });
}

export function resolveWelcomeTimeline(params: {
  isAuthenticated: boolean;
  bonus?: WelcomeBonusSnapshot | null;
  currency: string;
  t: TranslateFn;
}): WelcomeTimelineState {
  const { isAuthenticated, bonus, currency, t } = params;
  const limit = getWelcomeLimit(currency);
  const minDeposit = formatWelcomeMoney(limit.minDeposit, limit.currency);
  const maxBonus = formatWelcomeMoney(limit.maxBonus, limit.currency);
  const timeLeft = formatBonusTimeLeft(bonus?.expiresAt, t);
  const timeExpired = timeLeft === t("promo.timeExpired");
  const wagerPct = getWagerProgressPercent(bonus?.totalWagered, bonus?.requiredWager);
  const expired = bonus ? isBonusExpired(bonus.expiresAt) : false;

  if (!isAuthenticated) {
    return {
      currentStep: 1,
      progressPct: 8,
      headline: t("promo.tlGuestHeadline"),
      subline: t("promo.tlGuestSubline"),
      ctaLabel: t("promo.tlGuestCta"),
      ctaAction: "register",
      steps: buildSteps(1, null, t),
      timeLeft: null,
      timeExpired: false,
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
      headline: t("promo.tlExpiredDepositHeadline"),
      subline: t("promo.tlExpiredDepositSubline"),
      ctaLabel: t("promo.tlProfileCta"),
      ctaAction: "profile",
      steps: buildSteps(2, 2, t),
      timeLeft: t("promo.timeExpired"),
      timeExpired: true,
      wagerPct: 0,
    };
  }

  if (expired && bonus?.depositActivated) {
    return {
      currentStep: 4,
      progressPct: 75,
      headline: t("promo.tlExpiredWagerHeadline"),
      subline: t("promo.tlExpiredWagerSubline"),
      ctaLabel: t("promo.tlProfileCta"),
      ctaAction: "profile",
      steps: buildSteps(4, 4, t),
      timeLeft: t("promo.timeExpired"),
      timeExpired: true,
      wagerPct,
    };
  }

  if (completed) {
    return {
      currentStep: 5,
      progressPct: 100,
      headline: t("promo.tlCompletedHeadline"),
      subline: t("promo.tlCompletedSubline"),
      ctaLabel: t("promo.tlProfileCta"),
      ctaAction: "profile",
      steps: buildSteps(5, null, t),
      timeLeft: null,
      timeExpired: false,
      wagerPct: 100,
    };
  }

  if (wagering) {
    const remaining = 100 - wagerPct;
    return {
      currentStep: 4,
      progressPct: 62 + Math.round(wagerPct * 0.38),
      headline: t("promo.tlWageringHeadline", { remaining }),
      subline: timeLeft && !timeExpired
        ? t("promo.tlWageringSublineTimed", { time: timeLeft })
        : t("promo.tlWageringSubline"),
      ctaLabel: t("promo.tlWageringCta"),
      ctaAction: "bets",
      steps: buildSteps(4, null, t),
      timeLeft,
      timeExpired,
      wagerPct,
    };
  }

  if (locked) {
    return {
      currentStep: 2,
      progressPct: 28,
      headline: t("promo.tlDepositHeadline"),
      subline: timeLeft && !timeExpired
        ? t("promo.tlDepositSublineTimed", { minDeposit, maxBonus, time: timeLeft })
        : t("promo.tlDepositSubline", { minDeposit, maxBonus }),
      ctaLabel: t("promo.tlDepositCta", { minDeposit }),
      ctaAction: "deposit",
      steps: buildSteps(2, null, t),
      timeLeft,
      timeExpired,
      wagerPct: 0,
    };
  }

  if (bonus?.depositActivated) {
    return {
      currentStep: 4,
      progressPct: 55,
      headline: t("promo.tlStartWagerHeadline"),
      subline: t("promo.tlStartWagerSubline", {
        bonus: bonus.amount,
        currency,
      }),
      ctaLabel: t("promo.tlStartWagerCta"),
      ctaAction: "bets",
      steps: buildSteps(4, null, t),
      timeLeft,
      timeExpired,
      wagerPct: 0,
    };
  }

  return {
    currentStep: 2,
    progressPct: 22,
    headline: t("promo.tlDepositHeadline"),
    subline: t("promo.tlDepositActivateSubline", { minDeposit, maxBonus }),
    ctaLabel: t("promo.tlDepositCta", { minDeposit }),
    ctaAction: "deposit",
    steps: buildSteps(2, null, t),
    timeLeft,
    timeExpired,
    wagerPct: 0,
  };
}
