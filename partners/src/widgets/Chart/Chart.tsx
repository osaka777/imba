"use client";
import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getChartData, IChartData } from "@/entities/user/api/getChartData";
import styles from "./Chart.module.css";

interface ChartProps {
    selectedCurrency: string;
    period: 'day' | 'week' | 'month' | 'all';
}

export const Chart: React.FC<ChartProps> = ({ selectedCurrency, period }) => {
    const [chartData, setChartData] = useState<IChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);
    const [containerReady, setContainerReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            console.log('Chart useEffect triggered with period:', period, 'currency:', selectedCurrency);
            setLoading(true);
            setKey(prev => prev + 1);
            const data = await getChartData(selectedCurrency, period);
            console.log('Chart received data:', data);
            setChartData(data);
            setLoading(false);
        };

        fetchData();
    }, [selectedCurrency, period]);

    useEffect(() => {
        // Проверяем, что контейнер готов
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setContainerReady(true);
            } else {
                // Если размеры нулевые, ждем следующего кадра
                const timer = setTimeout(() => {
                    if (containerRef.current) {
                        const { width, height } = containerRef.current.getBoundingClientRect();
                        setContainerReady(width > 0 && height > 0);
                    }
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [loading, chartData]);

    const formatValue = (value: number) => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={styles.tooltip}>
                    <p className={styles.tooltipLabel}>{label}</p>
                    <p className={styles.tooltipValue}>
                        {formatValue(payload[0].value)} {selectedCurrency}
                    </p>
                </div>
            );
        }
        return null;
    };

    // Показываем загрузку или пустые данные
    if (loading || !chartData || chartData.data.length === 0) {
        return (
            <div className={styles.chartContainer} ref={containerRef}>
                <div className={styles.loading}>
                    <div className={styles.loadingSpinner}></div>
                    <p>{loading ? 'Загрузка данных...' : 'Нет данных для отображения'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.chartContainer} ref={containerRef}>
            {containerReady && (
                <ResponsiveContainer 
                    width="100%" 
                    height={400}
                    key={key}
                >
                    <AreaChart
                        data={chartData.data}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="colorStroke" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#3b82f6"/>
                                <stop offset="100%" stopColor="#8b5cf6"/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="date" 
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis 
                            stroke="#64748b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => formatValue(value)}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="url(#colorStroke)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};
