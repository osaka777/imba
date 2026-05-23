"use client";
import React, { useState } from "react";
import { DotsIcon } from "@/shared/assets/icons";
import dashboard from "./dashboard.module.css";
import '@styles/common.module.css'
import { ProfileStats } from "@/widgets/Stats/ProfileStats";
import { Chart } from "@/widgets/Chart/Chart";
import { CurrencySelector } from "@/widgets/CurrencySelector/CurrencySelector";

const Profile = () => {
    const [selectedCurrency, setSelectedCurrency] = useState("USD");
    const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>('month');

    const currencyOptions = ["USD", "KZT", "RUB", "UAH"] as const;

    return (
        <main className={dashboard.main}>
            <section className={dashboard.chart_section}>
                <div className={dashboard.chart_header}>
                    <h2 className={dashboard.chart_title}>Аналитика доходов</h2>
                    <CurrencySelector
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                        className={dashboard.currency_selector}
                        options={currencyOptions as unknown as string[]}
                    />
                </div>
                
                <div className={dashboard.chart}>
                    <Chart 
                        selectedCurrency={selectedCurrency}
                        period={selectedPeriod}
                    />
                </div>
            </section>
            <ProfileStats selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} selectedCurrency={selectedCurrency} />
        </main>
    );
};

export default Profile;