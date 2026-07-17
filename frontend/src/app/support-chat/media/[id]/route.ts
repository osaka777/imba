import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MEDIA_RE = /^[a-f0-9]{24}$/;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!MEDIA_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const botUrl = process.env.IMBA_BOT_URL || 'http://imba-bot:8088';
  try {
    const response = await fetch(`${botUrl.replace(/\/$/, '')}/support/media/${id}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: response.status });
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('[support-chat] media error', error);
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}
