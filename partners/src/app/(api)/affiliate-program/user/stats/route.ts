import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const token = cookies().get("access_token");

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Получаем выбранную валюту из параметров запроса
  const selectedCurrency = new URL(request.url).searchParams.get("currency") || "USD";
  
  // Генерируем тестовые данные для статистики
  const stats = {
    allTimeAffiliated: Math.floor(Math.random() * 1000) + 100,
    balanceForDay: (Math.random() * 100 + 10).toFixed(2),
    balanceForWeek: (Math.random() * 500 + 50).toFixed(2),
    balanceForMonth: (Math.random() * 1000 + 100).toFixed(2),
    balanceForAll: (Math.random() * 5000 + 500).toFixed(2),
    currency: selectedCurrency,
  };

  return NextResponse.json(stats);
}