import type { MessageKey } from "~/shared/i18n/messages";

/** Sticky bar «Welcome-бонус ждёт депозита» — временно выключен */
export const WELCOME_BONUS_STICKY_BANNER_ENABLED = false;

export const WELCOME_BONUS_TITLE = "Welcome";
export const WELCOME_BONUS_HIGHLIGHT = "×8";

export const WELCOME_BONUS_GRADIENT_FROM = "#F59E0B";
export const WELCOME_BONUS_GRADIENT_TO = "#B45309";

export const WELCOME_RULE_ICONS = ["🎁", "⏱", "📊", "💰", "⚽", "📈", "🎯"] as const;

export const WELCOME_RULE_KEYS = [
  { title: "promo.rule1Title", text: "promo.rule1Text" },
  { title: "promo.rule2Title", text: "promo.rule2Text" },
  { title: "promo.rule3Title", text: "promo.rule3Text" },
  { title: "promo.rule4Title", text: "promo.rule4Text" },
  { title: "promo.rule5Title", text: "promo.rule5Text" },
  { title: "promo.rule6Title", text: "promo.rule6Text" },
  { title: "promo.rule7Title", text: "promo.rule7Text" },
] as const satisfies ReadonlyArray<{ title: MessageKey; text: MessageKey }>;
