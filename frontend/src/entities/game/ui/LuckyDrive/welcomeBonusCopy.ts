/** Sticky bar «Welcome-бонус ждёт депозита» — временно выключен */
export const WELCOME_BONUS_STICKY_BANNER_ENABLED = false;

export const WELCOME_BONUS_TITLE = "Welcome";
export const WELCOME_BONUS_SUBTITLE = "40% на первый депозит";
export const WELCOME_BONUS_HIGHLIGHT = "×8";

export const WELCOME_BONUS_GRADIENT_FROM = "#F59E0B";
export const WELCOME_BONUS_GRADIENT_TO = "#B45309";

export const WELCOME_MODAL_TITLE = "Welcome-бонус Imba.bet";
export const WELCOME_MODAL_SUBTITLE =
  "Зарегистрируйся, пополни счёт в течение 24 часов и получи до 40% бонусом на бонусный счёт";

export const WELCOME_RULES = [
  { icon: "🎁", title: "40% от депозита", text: "Бонус начисляется после первого пополнения от минимальной суммы" },
  { icon: "⏱", title: "24 часа", text: "На пополнение и на отыгрыш — иначе бонус сгорает" },
  { icon: "📊", title: "Вейджер ×8", text: "Оборот = 8 × (депозит + бонус)" },
  { icon: "💰", title: "Вывод ×1.5", text: "После отыгрыша — не больше 1.5× суммы депозита с бонуса" },
  { icon: "⚽", title: "Исход и тотал", text: "П1 / X / П2 и тоталы, live и линия, ординар" },
  { icon: "📈", title: "Кэф 1.85–5", text: "Ставки вне диапазона не идут в отыгрыш" },
  { icon: "🎯", title: "До 15% баланса", text: "За одну ставку с бонусного счёта" },
] as const;

export const WELCOME_STEPS = [
  { n: 1, title: "Регистрация", text: "Выбери валюту счёта — welcome появится в профиле" },
  { n: 2, title: "Пополнение", text: "Внеси депозит от минимума в течение 24 ч" },
  { n: 3, title: "Активация", text: "40% бонусом на бонусный счёт, депозит — на основной" },
  { n: 4, title: "Отыгрыш", text: "Ставь с бонусного счёта на исход или тотал до выполнения вейджера" },
] as const;
