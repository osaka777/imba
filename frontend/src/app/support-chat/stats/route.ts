import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const botUrl = (process.env.IMBA_BOT_URL || 'http://imba-bot:8088').replace(/\/$/, '');
  try {
    const response = await fetch(`${botUrl}/support/stats`, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ ok: false, avgResponseMin: 3, under5mPct: 0 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[support-chat] stats error', error);
    return NextResponse.json({ ok: false, avgResponseMin: 3, under5mPct: 0 }, { status: 502 });
  }
}
