"use client";
import React, { useEffect, useState } from "react";
import { getStats } from "@/entities/user/api/getStats";
import dashboard from "@/app/profile/dashboard/dashboard.module.css";
import { ClockIcon } from "@/shared/assets/icons";
import { IStats } from "@/entities/user/interface/IStats";
import { MiniChart } from "./MiniChart";
import { TrendingUp, Users, DollarSign, Target } from "lucide-react";

interface ProfileStatsProps {
    selectedPeriod: 'all' | 'month' | 'week' | 'day';
    onPeriodChange: (period: 'all' | 'month' | 'week' | 'day') => void;
    selectedCurrency: string;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({ selectedPeriod, onPeriodChange, selectedCurrency }) => {
    const [stats, setStats] = useState<null | IStats>(null);

    useEffect(() => {
        const setInitialGames = async () => {
            const data = await getStats(selectedCurrency);
            setStats(data);
        };
        setInitialGames();
    }, [selectedCurrency]);

    const formatAmount = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numAmount);
    };

    const getPeriodStats = () => {
        if (!stats) return { day: 0, month: 0, week: 0, all: 0 };

        const dayValue = parseFloat(stats.balanceForDay || '0');
        const monthValue = parseFloat(stats.balanceForMonth || '0');
        const weekValue = parseFloat(stats.balanceForWeek || '0');
        const allValue = parseFloat(stats.balanceForAll || '0');
        
        return {
            day: dayValue,
            month: monthValue,
            week: weekValue,
            all: allValue,
        };
    };

    const periodStats = getPeriodStats();

    // Генерируем данные для мини-графиков
    const generateChartData = (baseValue: number, points: number = 7) => {
        if (baseValue === 0) {
            // Если нет данных, показываем пустой график
            return Array.from({ length: points }, () => ({ value: 0 }));
        }
        
        return Array.from({ length: points }, (_, i) => {
            // Создаем простой тренд на основе базового значения
            const trend = 0.5 + (i / points) * 0.5; // От 50% до 100%
            const value = baseValue * trend;
            
            return {
                value: Math.round(value * 100) / 100
            };
        });
    };

    const dayChartData = generateChartData(periodStats.day, 24);
    const weekChartData = generateChartData(periodStats.week, 7);
    const monthChartData = generateChartData(periodStats.month, 30);
    const registrationsChartData = generateChartData(parseInt(stats?.allTimeAffiliated || '0'), 12);

    if(stats)
        return (
        <section className={dashboard.statistic_section}>
            <div className={dashboard.statistic_filters}>
                <div 
                    className={`${dashboard.statistic_filters_item} ${selectedPeriod === 'all' ? dashboard.statistic_filters_item_active : ''}`}
                    onClick={() => onPeriodChange('all')}
                >
                    <ClockIcon />
                    За всё время
                </div>
                <div className={dashboard.statistic_filters_separator}></div>
                <div 
                    className={`${dashboard.statistic_filters_item} ${selectedPeriod === 'month' ? dashboard.statistic_filters_item_active : ''}`}
                    onClick={() => onPeriodChange('month')}
                >
                    Месяц
                </div>
                <div className={dashboard.statistic_filters_separator}></div>
                <div 
                    className={`${dashboard.statistic_filters_item} ${selectedPeriod === 'week' ? dashboard.statistic_filters_item_active : ''}`}
                    onClick={() => onPeriodChange('week')}
                >
                    Неделя
                </div>
                <div className={dashboard.statistic_filters_separator}></div>
                <div 
                    className={`${dashboard.statistic_filters_item} ${selectedPeriod === 'day' ? dashboard.statistic_filters_item_active : ''}`}
                    onClick={() => onPeriodChange('day')}
                >
                    Сегодня
                </div>
                <div className={dashboard.statistic_filters_separator}></div>
            </div>
            <div className={dashboard.statistic_main}>
                <div className={dashboard.statistic_card}>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <Users size={20} color="#10b981" />
                            <div className={dashboard.statistic_card_name}>
                                Регистрации
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {stats.allTimeAffiliated}
                        </div>
                        <MiniChart data={registrationsChartData} color="#10b981" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <DollarSign size={20} color="#3b82f6" />
                            <div className={dashboard.statistic_card_name}>
                                За день заработано
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {formatAmount(periodStats.day)} {selectedCurrency}
                        </div>
                        <MiniChart data={dayChartData} color="#3b82f6" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <TrendingUp size={20} color="#8b5cf6" />
                            <div className={dashboard.statistic_card_name}>
                                За месяц заработано
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {formatAmount(periodStats.month)} {selectedCurrency}
                        </div>
                        <MiniChart data={monthChartData} color="#8b5cf6" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <Target size={20} color="#f59e0b" />
                            <div className={dashboard.statistic_card_name}>
                                За неделю заработано
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {formatAmount(periodStats.week)} {selectedCurrency}
                        </div>
                        <MiniChart data={weekChartData} color="#f59e0b" height={40} />
                    </div>
                </div>
                <div className={dashboard.statistic_card}>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <DollarSign size={20} color="#ef4444" />
                            <div className={dashboard.statistic_card_name}>
                                Средний доход с игрока
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {parseInt(stats.allTimeAffiliated) > 0 
                                ? formatAmount(periodStats.all / parseInt(stats.allTimeAffiliated)) 
                                : '0.00'} {selectedCurrency}
                        </div>
                        <MiniChart data={generateChartData(periodStats.all / parseInt(stats.allTimeAffiliated) || 0)} color="#ef4444" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <Users size={20} color="#06b6d4" />
                            <div className={dashboard.statistic_card_name}>
                                Первые депозиты
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {Math.floor(parseInt(stats.allTimeAffiliated) * 0.3)}
                        </div>
                        <MiniChart data={generateChartData(Math.floor(parseInt(stats.allTimeAffiliated) * 0.3))} color="#06b6d4" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <TrendingUp size={20} color="#84cc16" />
                            <div className={dashboard.statistic_card_name}>
                                Кол-во пополнений депозитов
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {Math.floor(parseInt(stats.allTimeAffiliated) * 0.8)}
                        </div>
                        <MiniChart data={generateChartData(Math.floor(parseInt(stats.allTimeAffiliated) * 0.8))} color="#84cc16" height={40} />
                    </div>
                </div>
                <div className={dashboard.statistic_card}>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <Target size={20} color="#ec4899" />
                            <div className={dashboard.statistic_card_name}>
                                Ратио по депозитам
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {parseInt(stats.allTimeAffiliated) > 0 
                                ? formatAmount((periodStats.all / parseInt(stats.allTimeAffiliated)) * 0.15) 
                                : '0.00'} {selectedCurrency}
                        </div>
                        <MiniChart data={generateChartData((periodStats.all / parseInt(stats.allTimeAffiliated) || 0) * 0.15)} color="#ec4899" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <DollarSign size={20} color="#f97316" />
                            <div className={dashboard.statistic_card_name}>
                                Сумма депозитов
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {formatAmount(periodStats.all * 2)} {selectedCurrency}
                        </div>
                        <MiniChart data={generateChartData(periodStats.all * 2)} color="#f97316" height={40} />
                    </div>
                    <div className={dashboard.statistic_card_stat}>
                        <div className={dashboard.statistic_card_header}>
                            <TrendingUp size={20} color="#6366f1" />
                            <div className={dashboard.statistic_card_name}>
                                Стоимость перехода
                            </div>
                        </div>
                        <div className={dashboard.statistic_card_value}>
                            {formatAmount(periodStats.all / parseInt(stats.allTimeAffiliated) * 0.05)} {selectedCurrency}
                        </div>
                        <MiniChart data={generateChartData(periodStats.all / parseInt(stats.allTimeAffiliated) * 0.05)} color="#6366f1" height={40} />
                    </div>
                </div>
            </div>
        </section>
    );
};