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

export function getSupportPageHint(pathname: string): string | null {
  if (pathname.startsWith("/deposit")) {
    return "Укажите ID заявки из «Истории финансов» и приложите скрин чека.";
  }
  if (pathname.includes("/profile/financeHistory") || pathname.includes("/profile/wallets")) {
    return "Приложите номер операции и скрин статуса из истории финансов.";
  }
  if (pathname.includes("/profile/promocodes")) {
    return "Напишите код акции и что именно не начислилось.";
  }
  if (pathname.startsWith("/profile")) {
    return "Опишите проблему — оператор видит ваш профиль и баланс.";
  }
  return null;
}

export function tagLabel(tag?: string) {
  if (tag === "deposit") return "Пополнение";
  if (tag === "withdraw") return "Вывод";
  if (tag === "bonus") return "Бонус";
  return "Поддержка";
}
