import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const token = cookies().get("access_token");

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Генерируем тестовые данные для графиков
  const currencies = ["USD", "RUB"];
  const selectedCurrency = new URL(request.url).searchParams.get("currency") || "USD";
  
  const now = new Date();
  const data = [];
  
  // Генерируем данные за последние 30 дней
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Случайная сумма от 10 до 500
    const amount = (Math.random() * 490 + 10).toFixed(2);
    
    data.push({
      id: `op-${i}`,
      amount: amount,
      currencyCode: selectedCurrency,
      createdAt: date.toISOString(),
      type: Math.random() > 0.5 ? "deposit" : "withdrawal"
    });
  }

  return NextResponse.json({ data });
}