import { NextRequest, NextResponse } from 'next/server';

import { tRequest } from '~/shared/i18n/request-locale';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supportBotUsername =
    process.env.TELEGRAM_SUPPORT_BOT_USERNAME ||
    process.env.SUPPORT_BOT_USERNAME ||
    'Imbabetsupport_bot';
  const supportTelegramUrl =
    process.env.SUPPORT_TELEGRAM_URL ||
    process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ||
    'https://t.me/imbabetchat';

  return NextResponse.json({
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'imbabetalert_bot',
    supportBotUsername,
    telegramLabel: process.env.SUPPORT_TELEGRAM_LABEL || tRequest(request, 'support.tagSupport'),
    telegramUrl: supportTelegramUrl,
  });
}
