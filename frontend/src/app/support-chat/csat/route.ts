import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SESSION_RE = /^[a-zA-Z0-9_-]{6,32}$/;

export async function POST(request: NextRequest) {
  let body: { sessionId?: string; rating?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim() || '';
  const rating = Number(body.rating);
  if (!SESSION_RE.test(sessionId) || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const botUrl = (process.env.IMBA_BOT_URL || 'http://imba-bot:8088').replace(/\/$/, '');
  try {
    const response = await fetch(`${botUrl}/support/csat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, rating }),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[support-chat] csat error', error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
