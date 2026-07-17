import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SESSION_RE = /^[a-zA-Z0-9_-]{6,32}$/;

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() || '';
  const sinceRaw = request.nextUrl.searchParams.get('since') || '0';
  const since = Number.parseInt(sinceRaw, 10);

  if (!SESSION_RE.test(sessionId)) {
    return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 400 });
  }

  const botUrl = process.env.IMBA_BOT_URL || 'http://imba-bot:8088';
  const url = `${botUrl.replace(/\/$/, '')}/support-messages/${encodeURIComponent(sessionId)}?since=${Number.isFinite(since) ? since : 0}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ ok: false, messages: [] }, { status: response.status });
    }
    const data = (await response.json()) as { messages?: unknown[]; status?: string; meta?: unknown };
    return NextResponse.json({
      ok: true,
      messages: data.messages || [],
      status: data.status || "online",
      meta: data.meta || null,
    });
  } catch (error) {
    console.error('[support-chat] messages error', error);
    return NextResponse.json({ ok: false, messages: [] }, { status: 502 });
  }
}
