"use client";

import { useSearchParams } from "next/navigation";

import { DashboardAnalytics } from "@/widgets/DashboardAnalytics/DashboardAnalytics";
import { SubIdAnalytics } from "@/widgets/SubIdAnalytics/SubIdAnalytics";
import shell from "../profile-shell.module.css";

const SUB_DIMENSIONS = ["sub1", "sub2", "sub3", "sub4", "sub5"] as const;

export default function ProfileDashboardPage() {
  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub");
  const initialDimension = SUB_DIMENSIONS.includes(subParam as (typeof SUB_DIMENSIONS)[number])
    ? (subParam as (typeof SUB_DIMENSIONS)[number])
    : "sub1";

  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Dashboard</h1>
        <p className={shell.pageSubtitle}>
          Аналитика дохода, регистраций и первых депозитов в реальном времени
        </p>
      </header>
      <DashboardAnalytics />
      <SubIdAnalytics initialDimension={initialDimension} />
    </>
  );
}
