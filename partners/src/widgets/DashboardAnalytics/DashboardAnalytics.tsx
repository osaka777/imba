"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  Users,
  Wallet,
  Sparkles,
  UserPlus,
  Banknote,
} from "lucide-react";
import {
  ChartMetric,
  getChartData,
  IChartData,
} from "@/entities/user/api/getChartData";
import { getStats } from "@/entities/user/api/getStats";
import { IStats } from "@/entities/user/interface/IStats";
import { CurrencySelector } from "@/widgets/CurrencySelector/CurrencySelector";
import styles from "./DashboardAnalytics.module.css";

type Period = "day" | "week" | "month" | "all";

const METRICS: { id: ChartMetric; label: string }[] = [
  { id: "income", label: "Доход" },
  { id: "registrations", label: "Регистрации" },
  { id: "ftd", label: "FTD" },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "all", label: "Всё время" },
];

const METRIC_COLORS: Record<ChartMetric, string> = {
  income: "#089e4e",
  registrations: "#0855c4",
  ftd: "#6f48a7",
};

const currencyOptions = ["USD", "KZT", "RUB", "UAH"] as const;

export const DashboardAnalytics = () => {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("income");
  const [chartData, setChartData] = useState<IChartData | null>(null);
  const [stats, setStats] = useState<IStats | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerReady, setContainerReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [chart, stat] = await Promise.all([
        getChartData(selectedCurrency, selectedPeriod, selectedMetric),
        getStats(selectedCurrency),
      ]);
      setChartData(chart);
      setStats(stat);
      setLoading(false);
    };
    load();
  }, [selectedCurrency, selectedPeriod, selectedMetric]);

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setContainerReady(width > 0 && height > 0);
  }, [loading, chartData]);

  const formatAmount = (value: number | string, withCurrency = true) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: selectedMetric === "income" ? 2 : 0,
      maximumFractionDigits: selectedMetric === "income" ? 2 : 0,
    }).format(Number.isFinite(num) ? num : 0);
    return withCurrency && selectedMetric === "income"
      ? `${formatted} ${selectedCurrency}`
      : formatted;
  };

  const metricColor = METRIC_COLORS[selectedMetric];

  const kpiCards = useMemo(() => {
    if (!stats) return [];
    const money = (value: string) => {
      const num = parseFloat(value);
      return (
        new Intl.NumberFormat("ru-RU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number.isFinite(num) ? num : 0) + ` ${selectedCurrency}`
      );
    };
    return [
      { label: "Сегодня", value: money(stats.balanceForDay), icon: Sparkles, tone: "green" },
      { label: "Неделя", value: money(stats.balanceForWeek), icon: TrendingUp, tone: "blue" },
      { label: "Месяц", value: money(stats.balanceForMonth), icon: Wallet, tone: "purple" },
      { label: "Всё время", value: money(stats.balanceForAll), icon: Banknote, tone: "gold" },
      { label: "Регистрации", value: stats.allTimeAffiliated, icon: Users, tone: "cyan" },
      { label: "FTD", value: stats.firstDeposits ?? "0", icon: UserPlus, tone: "pink" },
    ];
  }, [stats, selectedCurrency]);

  const chartTotal = chartData?.total ?? 0;
  const totalLabel =
    selectedMetric === "income"
      ? formatAmount(chartTotal)
      : formatAmount(chartTotal, false);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        <p className={styles.tooltipValue} style={{ color: metricColor }}>
          {selectedMetric === "income"
            ? formatAmount(payload[0].value)
            : formatAmount(payload[0].value, false)}
        </p>
      </div>
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <span className={styles.heroEyebrow}>
              <span className={styles.liveDot} />
              Live
            </span>
            <p className={styles.heroLabel}>Доход за сегодня</p>
            <p className={styles.heroValue}>
              {stats ? formatAmount(stats.balanceForDay) : "—"}
            </p>
          </div>
          <div className={styles.heroBadge}>
            RevShare · 50%
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${styles.kpiCard} ${styles[`kpi_${card.tone}`]}`}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiIconWrap}>
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span className={styles.kpiLabel}>{card.label}</span>
              </div>
              <span className={styles.kpiValue}>{card.value}</span>
            </div>
          );
        })}
      </div>

      <section className={styles.chartCard}>
        <div className={styles.chartTop}>
          <div>
            <h2 className={styles.chartTitle}>Динамика</h2>
            <p className={styles.chartSubtitle}>
              {METRICS.find((m) => m.id === selectedMetric)?.label} ·{" "}
              {PERIODS.find((p) => p.id === selectedPeriod)?.label}
            </p>
          </div>
          <CurrencySelector
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            className={styles.currencySelector}
            options={currencyOptions as unknown as string[]}
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.segment}>
            {METRICS.map((metric) => (
              <button
                key={metric.id}
                type="button"
                className={`${styles.segmentBtn} ${
                  selectedMetric === metric.id ? styles.segmentBtnActive : ""
                }`}
                data-metric={metric.id}
                onClick={() => setSelectedMetric(metric.id)}
              >
                {metric.label}
              </button>
            ))}
          </div>
          <div className={styles.segment}>
            {PERIODS.map((period) => (
              <button
                key={period.id}
                type="button"
                className={`${styles.segmentBtn} ${styles.segmentBtnGhost} ${
                  selectedPeriod === period.id ? styles.segmentBtnGhostActive : ""
                }`}
                onClick={() => setSelectedPeriod(period.id)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.chartTotal}>
          <span className={styles.chartTotalLabel}>Итого за период</span>
          <span className={styles.chartTotalValue} style={{ color: metricColor }}>
            {loading ? "…" : totalLabel}
          </span>
        </div>

        <div className={styles.chartContainer} ref={containerRef}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Загрузка данных...</p>
            </div>
          ) : !chartData?.data?.length ? (
            <div className={styles.loading}>
              <p>Нет данных за выбранный период</p>
            </div>
          ) : containerReady ? (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart
                data={chartData.data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metricColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={metricColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8edf5" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) =>
                    selectedMetric === "income"
                      ? new Intl.NumberFormat("ru-RU", { notation: "compact" }).format(v)
                      : String(v)
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={metricColor}
                  strokeWidth={2.5}
                  fill="url(#chartFill)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: metricColor,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </section>
    </div>
  );
};
