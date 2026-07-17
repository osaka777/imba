import {
  GUIDE_FAQ,
  HOWTO_STEPS,
  KICK_GUIDE_BASE_URL,
} from "@/widgets/KickGuide/kick-guide-data";

export function buildKickGuideJsonLd() {
  const guideUrl = `${KICK_GUIDE_BASE_URL}/guide`;

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Как монетизировать Kick-стрим через партнёрку imba.bet",
    description:
      "Подключение Kick, партнёрские ссылки, чат-бот, OBS-оверлей и выплаты USDT для стримеров.",
    url: guideUrl,
    step: HOWTO_STEPS.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GUIDE_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Как монетизировать Kick-стрим через партнёрку imba.bet",
    description:
      "Пошаговый гид для стримеров Kick: RevShare, USDT, чат-бот, OBS и welcome $10.",
    url: guideUrl,
    inLanguage: "ru",
    author: {
      "@type": "Organization",
      name: "imba.bet",
      url: "https://imba.bet",
    },
    publisher: {
      "@type": "Organization",
      name: "imba.bet",
      url: "https://imba.bet",
    },
  };

  return [howTo, faq, article];
}
