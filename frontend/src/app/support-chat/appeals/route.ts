import { NextRequest, NextResponse } from 'next/server';

import { resolveSupportUserContext } from '../_lib/userContext';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await resolveSupportUserContext(request);
  if (!user.isAuthenticated || !user.userId) {
    return NextResponse.json({ ok: true, appeals: [] });
  }

  const botUrl = (process.env.IMBA_BOT_URL || 'http://imba-bot:8088').replace(/\/$/, '');
  try {
    const response = await fetch(
      `${botUrl}/support/user-appeals/${encodeURIComponent(String(user.userId))}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return NextResponse.json({ ok: true, appeals: [] });
    }
    const data = (await response.json()) as { appeals?: unknown[] };
    return NextResponse.json({ ok: true, appeals: data.appeals || [] });
  } catch (error) {
    console.error('[support-chat] appeals error', error);
    return NextResponse.json({ ok: false, appeals: [] }, { status: 502 });
  }
}
