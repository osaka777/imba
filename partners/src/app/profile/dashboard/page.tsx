"use client";

import { DashboardAnalytics } from "@/widgets/DashboardAnalytics/DashboardAnalytics";
import shell from "../profile-shell.module.css";

export default function ProfileDashboardPage() {
  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Dashboard</h1>
        <p className={shell.pageSubtitle}>
          Аналитика дохода, регистраций и первых депозитов в реальном времени
        </p>
      </header>
      <DashboardAnalytics />
    </>
  );
}
