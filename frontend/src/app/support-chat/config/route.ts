import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supportBotUsername =
    process.env.TELEGRAM_SUPPORT_BOT_USERNAME ||
    process.env.SUPPORT_BOT_USERNAME ||
    'Imbabetsupport_bot';
  const supportTelegramUrl =
    process.env.SUPPORT_TELEGRAM_URL ||
    process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ||
    `https://t.me/${supportBotUsername.replace(/^@/, '')}`;

  return NextResponse.json({
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'imbabetalert_bot',
    supportBotUsername,
    telegramLabel: process.env.SUPPORT_TELEGRAM_LABEL || 'Поддержка',
    telegramUrl: supportTelegramUrl,
  });
}
