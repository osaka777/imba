type ShareBetInput = {
  id: number;
  outcomeName: string | null;
  odds: string;
  stake: string;
  potentialPayout: string;
  currencyCode: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  eventSlug?: string | null;
};

export function buildWcBetShareText(input: ShareBetInput, baseUrl: string): string {
  const site = baseUrl.replace(/\/$/, '');
  const eventRef = input.eventSlug || '';
  const eventUrl = eventRef ? `${site}/game/${eventRef}` : site;
  const lines = [
    '🎯 Моя ставка на imba.bet',
    `${input.homeTeam} — ${input.awayTeam}`,
    `${input.outcomeName || 'Исход'} @ ${input.odds}`,
    `Сумма: ${input.stake} ${input.currencyCode}`,
    `Возможный выигрыш: ${input.potentialPayout} ${input.currencyCode}`,
    eventUrl,
  ];
  return lines.join('\n');
}

export function buildWcBetShareSvg(input: ShareBetInput): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const title = escape(`${input.homeTeam} — ${input.awayTeam}`);
  const pick = escape(input.outcomeName || 'Ставка');
  const odds = escape(`@ ${input.odds}`);
  const stake = escape(`${input.stake} ${input.currencyCode}`);
  const payout = escape(`→ ${input.potentialPayout} ${input.currencyCode}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="320" rx="16" fill="url(#bg)"/>
  <text x="32" y="48" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="14">imba.bet · ЧМ-2026</text>
  <text x="32" y="96" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="22" font-weight="700">${title}</text>
  <text x="32" y="148" fill="#38bdf8" font-family="system-ui,sans-serif" font-size="20" font-weight="600">${pick} ${odds}</text>
  <text x="32" y="188" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="16">${stake}</text>
  <text x="32" y="220" fill="#4ade80" font-family="system-ui,sans-serif" font-size="16">${payout}</text>
  <text x="32" y="280" fill="#64748b" font-family="system-ui,sans-serif" font-size="12">#${input.id}</text>
</svg>`;
}
