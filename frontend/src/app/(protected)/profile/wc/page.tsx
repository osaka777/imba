"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { fetchWcMyTournament } from "~/entities/wc-odds/api/client";
import { getSessionClient } from "~/entities/user/lib";
import { useLocale } from "~/shared/model/useLocale";

export default function WcTournamentPage() {
  const { t } = useLocale();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wc-my-tournament"],
    queryFn: async () => {
      const token = getSessionClient();
      if (!token) throw new Error(t("coupon.wcAuthRequired"));
      return fetchWcMyTournament(token);
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        {t("coupon.loadingShort")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#f87171" }}>
        {error instanceof Error ? error.message : t("coupon.wcLoadError")}
      </div>
    );
  }

  const { summary, favoriteTeam, openBets, recentSettled } = data;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
        {t("coupon.wcTitle")}
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label={t("coupon.wcStatBets")} value={String(summary.totalBets)} />
        <StatCard label={t("coupon.wcStatWins")} value={String(summary.wins)} accent="#4ade80" />
        <StatCard label={t("coupon.wcStatLosses")} value={String(summary.losses)} accent="#f87171" />
        <StatCard label={t("coupon.wcStatPending")} value={String(summary.pending)} accent="#38bdf8" />
        <StatCard label={t("coupon.wcStatTurnover")} value={`${summary.totalStaked}`} />
        {summary.roiPercent != null ? (
          <StatCard
            label="ROI"
            value={`${summary.roiPercent > 0 ? "+" : ""}${summary.roiPercent}%`}
            accent={summary.roiPercent >= 0 ? "#4ade80" : "#f87171"}
          />
        ) : null}
      </div>

      {favoriteTeam ? (
        <p style={{ marginBottom: "1.5rem", color: "#94a3b8" }}>
          {t("coupon.wcFavorite")}{" "}
          <strong style={{ color: "#e2e8f0" }}>{favoriteTeam.name}</strong>
          {" "}({favoriteTeam.betCount})
        </p>
      ) : null}

      <BetSection
        title={t("coupon.wcOpenBets")}
        bets={openBets}
        empty={t("coupon.wcNoOpen")}
        betFallback={t("coupon.wcBetFallback")}
        toMatch={t("coupon.wcToMatch")}
      />
      <BetSection
        title={t("coupon.wcRecent")}
        bets={recentSettled}
        empty={t("coupon.wcNoSettled")}
        betFallback={t("coupon.wcBetFallback")}
        toMatch={t("coupon.wcToMatch")}
      />

      <Link href="/line/soccer" style={{ color: "#38bdf8", marginTop: "1.5rem", display: "inline-block" }}>
        {t("coupon.wcGoLine")}
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "#e2e8f0",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "12px",
        background: "rgba(30, 41, 59, 0.6)",
        border: "1px solid rgba(148, 163, 184, 0.15)",
      }}
    >
      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function BetSection({
  title,
  bets,
  empty,
  betFallback,
  toMatch,
}: {
  title: string;
  bets: Array<{
    id: number;
    outcomeName?: string | null;
    odds: string;
    stake: string;
    status: string;
    event?: { homeTeam?: string; awayTeam?: string; slug?: string } | null;
  }>;
  empty: string;
  betFallback: string;
  toMatch: string;
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>{title}</h2>
      {!bets.length ? (
        <p style={{ color: "#64748b" }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {bets.map((bet) => (
            <li
              key={bet.id}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.5)",
                border: "1px solid rgba(148, 163, 184, 0.1)",
              }}
            >
              <div style={{ fontWeight: 500 }}>
                {bet.event?.homeTeam} — {bet.event?.awayTeam}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                {bet.outcomeName || betFallback} @ {bet.odds} · {bet.stake} · {bet.status}
              </div>
              {bet.event?.slug ? (
                <Link
                  href={`/game/${bet.event.slug}`}
                  style={{ fontSize: "0.8rem", color: "#38bdf8", marginTop: "0.35rem", display: "inline-block" }}
                >
                  {toMatch}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
