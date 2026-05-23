import { Metadata } from "next";

export const makeMetadata = (
  title: string | undefined = undefined,
): Metadata => {
  if (title) {
    title = `${title} - Imba.bet`;
  } else {
    title = `Imba.bet - Букмекерская контора`;
  }

  return {
    description:
      "Букмекерская контора — Имба, ставки лайв и линии на теннис, футбол, баскетбол, трансляция матчей",
    keywords:
      "букмекерская контора, ставки на спорт, спортивные ставки, коэффициенты, live-ставки, прогнозы, азартные игры, выигрыши, регистрация, бонусы, онлайн-ставки, киберспорт, статистика, безопасные ставки, мобильные ставки.",
    title,
  };
};
