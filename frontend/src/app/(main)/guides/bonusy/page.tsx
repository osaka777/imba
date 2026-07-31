"use client";

import Link from "next/link";

import { useLocale } from "~/shared/model/useLocale";

import styles from "../guides.module.css";
import bonusStyles from "./bonusGuide.module.css";
import { BonusGuideLimits } from "./BonusGuideLimits";

export default function BonusGuidePage() {
  const { t } = useLocale();

  const steps = [
    { title: t("guides.bonusStep1Title"), text: t("guides.bonusStep1Text") },
    { title: t("guides.bonusStep2Title"), text: t("guides.bonusStep2Text") },
    { title: t("guides.bonusStep3Title"), text: t("guides.bonusStep3Text") },
    { title: t("guides.bonusStep4Title"), text: t("guides.bonusStep4Text") },
  ];

  const wagerRules = [
    { icon: "🎯", title: t("guides.bonusRule1Title"), text: t("guides.bonusRule1Text") },
    { icon: "⚽", title: t("guides.bonusRule2Title"), text: t("guides.bonusRule2Text") },
    { icon: "📺", title: t("guides.bonusRule3Title"), text: t("guides.bonusRule3Text") },
    { icon: "📈", title: t("guides.bonusRule4Title"), text: t("guides.bonusRule4Text") },
    { icon: "🎯", title: t("guides.bonusRule5Title"), text: t("guides.bonusRule5Text") },
  ];

  return (
    <article className={`${styles.wrapper} ${bonusStyles.page}`}>
      <nav className={styles.nav}>
        <Link href="/guides">{t("guides.backGuides")}</Link>
      </nav>

      <header className={bonusStyles.hero}>
        <div className={bonusStyles.heroInner}>
          <span className={bonusStyles.heroBadge}>{t("guides.bonusBadge")}</span>
          <h1 className={bonusStyles.heroTitle}>{t("guides.bonusHeroTitle")}</h1>
          <p className={bonusStyles.heroLead}>{t("guides.bonusHeroLead")}</p>
          <div className={bonusStyles.statsRow}>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>40%</span>
              <span className={bonusStyles.statLabel}>{t("guides.bonusStatBonus")}</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>×8</span>
              <span className={bonusStyles.statLabel}>{t("guides.bonusStatWager")}</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>1.85–5</span>
              <span className={bonusStyles.statLabel}>{t("guides.bonusStatOdds")}</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>24ч</span>
              <span className={bonusStyles.statLabel}>{t("guides.bonusStatWindow")}</span>
            </div>
          </div>
        </div>
      </header>

      <section className={`${bonusStyles.card} ${bonusStyles.timeline}`}>
        <h2 className={bonusStyles.sectionTitle}>{t("guides.bonusHowTitle")}</h2>
        <ol className={bonusStyles.timelineList}>
          {steps.map((step, index) => (
            <li key={step.title} className={bonusStyles.timelineItem}>
              <span className={bonusStyles.timelineNum}>{index + 1}</span>
              <div className={bonusStyles.timelineBody}>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <BonusGuideLimits />

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>{t("guides.bonusRulesTitle")}</h2>
        <div className={bonusStyles.rulesGrid}>
          {wagerRules.map((rule) => (
            <div key={rule.title} className={bonusStyles.ruleChip}>
              <span className={bonusStyles.ruleIcon}>{rule.icon}</span>
              <div>
                <strong>{rule.title}</strong>
                <span>{rule.text}</span>
              </div>
            </div>
          ))}
        </div>
        <ul className={bonusStyles.listPlain} style={{ marginTop: 16 }}>
          <li>{t("guides.bonusRuleNote1")}</li>
          <li>{t("guides.bonusRuleNote2")}</li>
        </ul>
      </section>

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>{t("guides.bonusExtraTitle")}</h2>
        <ul className={bonusStyles.listPlain}>
          <li>{t("guides.bonusExtra1")}</li>
          <li>{t("guides.bonusExtra2")}</li>
          <li>{t("guides.bonusExtra3")}</li>
          <li>{t("guides.bonusExtra4")}</li>
        </ul>
      </section>

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>{t("guides.bonusPromoTitle")}</h2>
        <ol className={bonusStyles.orderedList}>
          <li>{t("guides.bonusPromo1")}</li>
          <li>{t("guides.bonusPromo2")}</li>
          <li>{t("guides.bonusPromo3")}</li>
        </ol>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile">
          {t("guides.bonusCtaDeposit")}
        </Link>
        <Link className={styles.link} href="/profile/promocodes">
          {t("guides.bonusCtaPromos")}
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/info">
          {t("guides.bonusCtaRules")}
        </Link>
      </div>
    </article>
  );
}
