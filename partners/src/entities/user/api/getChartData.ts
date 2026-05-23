"use server";
import { cookies } from "next/headers";
import { api } from "@/shared/api";

export interface IChartDataPoint {
    date: string;
    value: number;
}

export interface IChartData {
    data: IChartDataPoint[];
    currency: string;
}

export async function getChartData(currency: string, period: 'day' | 'week' | 'month' | 'all') {
    const token = cookies().get("access_token");

    if (!token) {
        console.log('No token found');
        return null;
    }
    
    try {
        const params = `?currency=${currency}&period=${period}`;
        const url = `/affiliate-program/user/chart-data${params}`;
        console.log('Fetching chart data with URL:', url);
        console.log('API baseURL:', api.defaults.baseURL);
        console.log('Token:', token.value ? 'Present' : 'Missing');
        console.log('Period requested:', period);
        
        const response = await api.get<IChartData>(url, { 
            headers: { Authorization: `Bearer ${token.value}` } 
        });
        console.log('Chart data response:', response.data);
        return response.data;
    } catch (error: any) {
        console.error('Error fetching chart data:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        // Временно возвращаем моковые данные для тестирования
        console.log('Returning mock data for period:', period);
        const mockData = generateMockData(currency, period);
        console.log('Generated mock data:', mockData);
        return mockData;
    }
}

function generateMockData(currency: string, period: 'day' | 'week' | 'month' | 'all'): IChartData {
    const now = new Date();
    const data: IChartDataPoint[] = [];
    
    let points: number;
    let daysBack: number;
    
    switch (period) {
        case 'day':
            points = 24;
            daysBack = 1;
            break;
        case 'week':
            points = 7;
            daysBack = 7;
            break;
        case 'month':
            points = 30;
            daysBack = 30;
            break;
        case 'all':
            points = 12;
            daysBack = 365;
            break;
    }
    
    console.log(`Generating ${points} points for period: ${period}`);
    
    for (let i = points - 1; i >= 0; i--) {
        const date = new Date(now);
        if (period === 'day') {
            date.setHours(date.getHours() - i);
        } else {
            date.setDate(date.getDate() - (i * daysBack / points));
        }
        
        // Генерируем случайные значения с трендом роста
        const baseValue = 100 + Math.random() * 200;
        const trend = 1 + (i / points) * 0.5; // Тренд роста
        const value = baseValue * trend + Math.random() * 50;
        
        data.push({
            date: period === 'day' 
                ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString('ru-RU', { 
                    day: '2-digit', 
                    month: period === 'all' ? 'short' : '2-digit',
                    year: period === 'all' ? 'numeric' : undefined
                }),
            value: Math.round(value * 100) / 100
        });
    }
    
    const result = {
        data,
        currency
    };
    
    console.log(`Generated ${data.length} data points for ${period}:`, result);
    return result;
}
