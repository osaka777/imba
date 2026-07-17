import { NextRequest, NextResponse } from 'next/server';

import { resolveSupportUserContext } from '../_lib/userContext';

export const dynamic = 'force-dynamic';

type HitBucket = { count: number; resetAt: number };

const hits = new Map<string, HitBucket>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 12;
const SESSION_RE = /^[a-zA-Z0-9_-]{6,32}$/;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = hits.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const userContext = await resolveSupportUserContext(request);
  const rateKey = userContext.userId ? `user:${userContext.userId}` : `ip:${ip}`;
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { ok: false, error: 'Слишком много сообщений. Попробуйте через минуту.' },
      { status: 429 },
    );
  }

  let body: {
    message?: string;
    sessionId?: string;
    pageUrl?: string;
    pageTitle?: string;
    imageUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Некорректный запрос' }, { status: 400 });
  }

  const text = body.message?.trim() || '';
  const imageUrl = body.imageUrl?.trim() || '';
  const sessionId = body.sessionId?.trim() || '';
  if ((!text && !imageUrl) || text.length > 2000) {
    return NextResponse.json(
      { ok: false, error: 'Сообщение или скрин обязательны (до 2000 символов)' },
      { status: 400 },
    );
  }
  if (!SESSION_RE.test(sessionId)) {
    return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 400 });
  }

  const botUrl = process.env.IMBA_BOT_URL || 'http://imba-bot:8088';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const notifySecret = process.env.TELEGRAM_NOTIFY_SECRET;
  if (notifySecret) headers['X-Notify-Secret'] = notifySecret;

  try {
    const response = await fetch(`${botUrl.replace(/\/$/, '')}/notify-support`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: text,
        sessionId,
        pageUrl: body.pageUrl,
        pageTitle: body.pageTitle,
        imageUrl: imageUrl || undefined,
        clientIp: ip,
        userId: userContext.userId,
        userEmail: userContext.userEmail,
        userLogin: userContext.userLogin,
        balanceSummary: userContext.balanceSummary,
        isAuthenticated: userContext.isAuthenticated,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[support-chat] notify failed', response.status, detail.slice(0, 300));
      return NextResponse.json(
        {
          ok: false,
          error: 'Оператор offline. Попробуйте позже или напишите в Telegram.',
          telegramUrl:
            process.env.SUPPORT_TELEGRAM_URL ||
            process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ||
            'https://t.me/imbabetchat',
        },
        { status: response.status === 503 ? 503 : 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      telegramUrl:
        process.env.SUPPORT_TELEGRAM_URL ||
        process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ||
        'https://t.me/imbabetchat',
    });
  } catch (error) {
    console.error('[support-chat] notify error', error);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сети. Попробуйте ещё раз.' },
      { status: 502 },
    );
  }
}
