const STATSHUB_ORIGIN = 'https://statshub.sportradar.com';

const OLIMPBET_SR_CLIENT_ID = 'd28c3e083e9d286082f4ab2e7f8052ca';

const STATSHUB_FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,*/*',
  Referer: 'https://olimpbet.kz/',
  Origin: 'https://olimpbet.kz',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

export function sanitizeStatshubMatchId(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function statshubMatchReferer(numericMatchId: string): string {
  return `${STATSHUB_ORIGIN}/olimpbetkz/ru/match/${numericMatchId}`;
}

export function rewriteStatshubHtmlForProxy(html: string, assetProxyBase: string): string {
  let out = html.replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    '',
  );

  out = out.replace(
    /((?:href|src)=["'])\/(?!\/)([^"']*)/gi,
    (_match, prefix: string, path: string) =>
      `${prefix}${assetProxyBase}?p=${encodeURIComponent(`/${path}`)}`,
  );

  return out;
}

export async function fetchStatshubMatchEmbedHtml(
  numericMatchId: string,
  assetProxyBase?: string,
): Promise<string | null> {
  const safeId = sanitizeStatshubMatchId(numericMatchId);
  if (!safeId) return null;

  const url = `${STATSHUB_ORIGIN}/olimpbetkz/ru/match/${safeId}`;
  const response = await fetch(url, { headers: STATSHUB_FETCH_HEADERS });
  if (!response.ok) return null;

  let html = await response.text();
  if (assetProxyBase) {
    html = rewriteStatshubHtmlForProxy(html, assetProxyBase);
  } else if (!/<base\s/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${STATSHUB_ORIGIN}/">`,
    );
  }

  return html;
}

export async function fetchStatshubAsset(
  numericMatchId: string,
  assetPath: string,
): Promise<Response | null> {
  const safeId = sanitizeStatshubMatchId(numericMatchId);
  if (!safeId || !assetPath.startsWith('/')) return null;

  const url = `${STATSHUB_ORIGIN}${assetPath}`;
  return fetch(url, {
    headers: {
      ...STATSHUB_FETCH_HEADERS,
      Referer: statshubMatchReferer(safeId),
    },
  });
}

/** Fallback when StatsHub HTML is unavailable — Sportradar H2H widget. */
export function buildH2hStandalonePage(numericMatchId: string): string {
  const safeId = sanitizeStatshubMatchId(numericMatchId);
  if (!safeId) return '';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>H2H</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;background:#0b1220;color:#cbd5e1;font-family:system-ui,sans-serif}
    #sr-widget{min-height:360px;padding:8px}
  </style>
</head>
<body>
  <div id="sr-widget"></div>
  <script>
    (function(a,b,c,d,e,f,g,h,i){a[e]||(i=a[e]=function(){(a[e].q=a[e].q||[]).push(arguments)},i.l=1*new Date,i.o=f,
    g=b.createElement(c),h=b.getElementsByTagName(c)[0],g.async=1,g.src=d,g.setAttribute("n",e),h.parentNode.insertBefore(g,h)
    )})(window,document,"script","https://widgets.sir.sportradar.com/${OLIMPBET_SR_CLIENT_ID}/widgetloader","SIR", {
      language: 'ru'
    });
    SIR('addWidget', '#sr-widget', 'headToHead.standalone', {
      matchId: ${safeId},
      layout: 'inline',
      components: ['headtohead', 'form', 'lastmatches']
    });
  </script>
</body>
</html>`;
}
