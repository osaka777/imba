"use client";
import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./MiniChart.module.css";

interface MiniChartProps {
    data: Array<{ value: number }>;
    color?: string;
    height?: number;
}

export const MiniChart: React.FC<MiniChartProps> = ({ 
    data, 
    color = "#8884d8", 
    height = 60 
}) => {
    if (!data || data.length === 0) {
        return (
            <div className={styles.noData} style={{ height }}>
                <span>Нет данных</span>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={styles.tooltip} style={{ backgroundColor: color }}>
                    <span>{new Intl.NumberFormat('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }).format(payload[0].value)}</span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={styles.container} style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
                    />
                    <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
