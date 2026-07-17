import type { PublicPartnerLanding } from "../types";
import { EventCard } from "../components/EventCard";
import styles from "../landing.module.css";

type Props = {
  landing: PublicPartnerLanding;
};

export function HeroMatchTemplate({ landing }: Props) {
  const event = landing.events[0];
  if (!event) return null;

  return (
    <div className={styles.heroWrap}>
      <div className={styles.heroGlow} />
      <div className={styles.heroInner}>
        <p className={styles.heroEyebrow}>Imba.bet · RevShare {landing.partnerPercent}%</p>
        <h1 className={styles.heroTitle}>
          {landing.headline || landing.title || "Топ-матч дня"}
        </h1>
        {landing.subheadline ? (
          <p className={styles.heroSubtitle}>{landing.subheadline}</p>
        ) : null}
        {landing.promoCode ? (
          <div className={styles.promoRibbon}>
            Промокод: <strong>{landing.promoCode}</strong>
          </div>
        ) : null}
        <EventCard event={event} ctaUrl={landing.ctaUrl} large />
      </div>
    </div>
  );
}

export function EventsGridTemplate({ landing }: Props) {
  return (
    <div className={styles.gridWrap}>
      <header className={styles.gridHeader}>
        <h1 className={styles.gridTitle}>
          {landing.headline || landing.title}
        </h1>
        {landing.subheadline ? (
          <p className={styles.gridSubtitle}>{landing.subheadline}</p>
        ) : null}
      </header>
      <div className={styles.eventsGrid}>
        {landing.events.map((event) => (
          <EventCard key={event.id} event={event} ctaUrl={landing.ctaUrl} />
        ))}
      </div>
    </div>
  );
}

export function PromoFocusTemplate({ landing }: Props) {
  return (
    <div className={styles.promoWrap}>
      <div className={styles.promoBanner}>
        <p className={styles.promoEyebrow}>Эксклюзив для новых игроков</p>
        <h1 className={styles.promoTitle}>
          {landing.headline || landing.title}
        </h1>
        {landing.subheadline ? (
          <p className={styles.promoSubtitle}>{landing.subheadline}</p>
        ) : null}
        {landing.promoCode ? (
          <div className={styles.promoCodeBig}>{landing.promoCode}</div>
        ) : null}
        <a href={landing.ctaUrl} className={styles.promoCta}>
          Забрать бонус и зарегистрироваться
        </a>
      </div>
      <div className={styles.promoEvents}>
        {landing.events.map((event) => (
          <EventCard key={event.id} event={event} ctaUrl={landing.ctaUrl} />
        ))}
      </div>
    </div>
  );
}
