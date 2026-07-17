"use client";

import { formatCurrencySymbol, formatMoney } from "@/shared/lib/formatCurrencySymbol";

import styles from "./KickStreamAnalytics.module.css";

export type KickAnalytics = {
  periodDays: number;
  currencyCode: string;
  kickTraffic: {
    registrations: number;
    ftd: number;
    commission: number;
    connectBonus: number;
    connectBonusGranted: boolean;
    conversionPct: number;
  };
  duringLive: {
    registrations: number;
    ftd: number;
  };
  sessions30d: {
    count: number;
    compliantHours: number;
    totalPeakViewers: number;
    brandedSessions: number;
  };
  byChannel: Array<{
    channel: string;
    registrations: number;
    ftd: number;
  }>;
};

type Props = {
  data: KickAnalytics | null;
  loading?: boolean;
};

export function KickStreamAnalytics({ data, loading = false }: Props) {
  if (loading) {
    return (
      <section className={styles.card}>
        <p className={styles.muted}>Загружаем аналитику Kick…</p>
      </section>
    );
  }

  if (!data) return null;

  const roiParts: string[] = [];
  if (data.duringLive.registrations > 0) {
    roiParts.push(`${data.duringLive.registrations} рег. во время эфиров`);
  }
  if (data.sessions30d.totalPeakViewers > 0) {
    roiParts.push(`пик зрителей ${data.sessions30d.totalPeakViewers}`);
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Результат с Kick за {data.periodDays} дней</h2>
        <span className={styles.currency}>{formatCurrencySymbol(data.currencyCode)}</span>
      </div>
      {roiParts.length > 0 ? (
        <p className={styles.roi}>{roiParts.join(" · ")}</p>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Регистрации (sub1=kick)</span>
          <span className={styles.statValue}>{data.kickTraffic.registrations}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>FTD</span>
          <span className={styles.statValue}>{data.kickTraffic.ftd}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Конверсия</span>
          <span className={styles.statValue}>{data.kickTraffic.conversionPct}%</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Welcome-бонус Kick</span>
          <span className={styles.statValue}>
            {data.kickTraffic.connectBonusGranted
              ? `$${data.kickTraffic.connectBonus.toLocaleString("en-US")}`
              : "—"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Комиссия</span>
          <span className={styles.statValue}>
            {formatMoney(data.kickTraffic.commission, data.currencyCode)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Реги во время эфира</span>
          <span className={styles.statValue}>{data.duringLive.registrations}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>FTD во время эфира</span>
          <span className={styles.statValue}>{data.duringLive.ftd}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Эфиров</span>
          <span className={styles.statValue}>{data.sessions30d.count}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Бренд-часы</span>
          <span className={styles.statValue}>{data.sessions30d.compliantHours} ч</span>
        </div>
      </div>

      {data.byChannel.length > 0 ? (
        <div className={styles.channels}>
          <h3 className={styles.channelsTitle}>По каналам (sub2)</h3>
          <div className={styles.channelsTableWrap}>
            <table className={styles.channelsTable}>
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>Регистрации</th>
                  <th>FTD</th>
                </tr>
              </thead>
              <tbody>
                {data.byChannel.slice(0, 8).map((row) => (
                  <tr key={row.channel}>
                    <td>{row.channel}</td>
                    <td>{row.registrations}</td>
                    <td>{row.ftd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
