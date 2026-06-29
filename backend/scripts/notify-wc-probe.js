#!/usr/bin/env node
/** POST probe alert to imba-bot (no curl/python required). */
const headline = process.env.PROBE_HEADLINE || 'WC bet probe alert';
const exitCode = Number(process.env.PROBE_EXIT || '1');
const url = process.env.TELEGRAM_NOTIFY_SMOKE_URL || 'http://imba-bot:8088/notify-smoke';
const secret = process.env.TELEGRAM_NOTIFY_SECRET || process.env.NOTIFY_SECRET || '';

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const details = Buffer.concat(chunks).toString('utf8').slice(0, 3500);

  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Notify-Secret'] = secret;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: headline, details, exitCode }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`notify failed: HTTP ${res.status} ${text}`);
    process.exit(1);
  }
  console.log('notify_ok');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
