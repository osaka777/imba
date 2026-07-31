import { getClientLocale } from "~/shared/i18n/get-client-locale";
import { translate, type MessageKey, type TranslateParams } from "~/shared/i18n/messages";

export type SupportSessionMeta = {
  closed?: boolean;
  closedAt?: number | null;
  tag?: string;
  csat?: number | null;
  awaitingCsat?: boolean;
};

export type SupportAppeal = {
  sessionId: string;
  tag?: string;
  preview?: string;
  updatedAt?: number;
  closed?: boolean;
  csat?: number | null;
  awaitingCsat?: boolean;
};

export type SupportStats = {
  avgResponseMin: number;
  under5mPct: number;
  openCount: number;
  pendingOver10m: number;
  avgCsat?: number | null;
};

export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

function resolveT(t?: TranslateFn): TranslateFn {
  if (t) return t;
  const locale = getClientLocale();
  return (key, params) => translate(locale, key, params);
}

export function getSupportPageHint(pathname: string, t?: TranslateFn): string | null {
  const tr = resolveT(t);
  if (pathname.startsWith("/deposit")) {
    return tr("support.hintDeposit");
  }
  if (pathname.includes("/profile/financeHistory") || pathname.includes("/profile/wallets")) {
    return tr("support.hintWithdraw");
  }
  if (pathname.includes("/profile/promocodes")) {
    return tr("support.hintBonus");
  }
  if (pathname.startsWith("/profile")) {
    return tr("support.hintDefault");
  }
  return null;
}

export function tagLabel(tag?: string, t?: TranslateFn) {
  const tr = resolveT(t);
  if (tag === "deposit") return tr("support.tagDeposit");
  if (tag === "withdraw") return tr("support.tagWithdraw");
  if (tag === "bonus") return tr("support.tagBonus");
  return tr("support.tagSupport");
}
