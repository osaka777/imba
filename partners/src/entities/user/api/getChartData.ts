"use server";

import { cookies } from "next/headers";
import { api } from "@/shared/api";

export type ChartMetric = "income" | "registrations" | "ftd";

export interface IChartDataPoint {
  date: string;
  value: number;
}

export interface IChartData {
  data: IChartDataPoint[];
  currency: string;
  metric?: ChartMetric;
  total?: number;
}

export async function getChartData(
  currency: string,
  period: "day" | "week" | "month" | "all",
  metric: ChartMetric = "income",
): Promise<IChartData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");

  if (!token) return null;

  try {
    const params = new URLSearchParams({
      currency,
      period,
      metric,
    });
    const { data } = await api.get<IChartData>(
      `/affiliate-program/user/chart-data?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token.value}` } },
    );
    return data;
  } catch {
    return null;
  }
}
