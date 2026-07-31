import { NextRequest, NextResponse } from 'next/server';

import { tRequest } from '~/shared/i18n/request-locale';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: tRequest(request, 'common.errFileNotFound') }, { status: 400 });
  }
  if (!file.type.startsWith('image/') || file.size < 1 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: tRequest(request, 'common.errImageTooLarge') },
      { status: 400 },
    );
  }

  const botUrl = process.env.IMBA_BOT_URL || 'http://imba-bot:8088';
  const headers: Record<string, string> = {};
  const notifySecret = process.env.TELEGRAM_NOTIFY_SECRET;
  if (notifySecret) headers['X-Notify-Secret'] = notifySecret;

  const body = new FormData();
  body.append('file', file, file.name || 'screenshot.jpg');

  try {
    const response = await fetch(`${botUrl.replace(/\/$/, '')}/support/upload`, {
      method: 'POST',
      headers,
      body,
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      url?: string;
      mediaId?: string;
      detail?: string;
    } | null;
    if (!response.ok || !data?.url) {
      return NextResponse.json(
        { ok: false, error: data?.detail || tRequest(request, 'common.errUploadFile') },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ ok: true, url: data.url, mediaId: data.mediaId });
  } catch (error) {
    console.error('[support-chat] upload error', error);
    return NextResponse.json({ ok: false, error: tRequest(request, 'common.errUploadGeneric') }, { status: 502 });
  }
}
