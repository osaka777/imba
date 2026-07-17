import { NextRequest, NextResponse } from 'next/server';

import { resolveSupportUserContext } from '../_lib/userContext';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await resolveSupportUserContext(request);
  if (!user.isAuthenticated || !user.userId) {
    return NextResponse.json({ ok: true, sessionId: null, messages: [] });
  }

  const botUrl = (process.env.IMBA_BOT_URL || 'http://imba-bot:8088').replace(/\/$/, '');
  try {
    const response = await fetch(
      `${botUrl}/support/user-session/${encodeURIComponent(String(user.userId))}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return NextResponse.json({ ok: true, sessionId: null, messages: [] });
    }
    const data = (await response.json()) as {
      sessionId?: string | null;
      messages?: unknown[];
      meta?: unknown;
    };
    return NextResponse.json({
      ok: true,
      sessionId: data.sessionId || null,
      messages: data.messages || [],
      meta: data.meta || null,
    });
  } catch (error) {
    console.error('[support-chat] session error', error);
    return NextResponse.json({ ok: false, sessionId: null, messages: [] }, { status: 502 });
  }
}
