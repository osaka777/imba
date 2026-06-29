import { writeFileSync } from 'fs';

import type { WcBetProbeFinding, WcBetProbeReport } from './types';

function severityRank(severity: WcBetProbeFinding['severity']): number {
  if (severity === 'error') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export function sortFindings(findings: WcBetProbeFinding[]): WcBetProbeFinding[] {
  return [...findings].sort((a, b) => {
    const sa = severityRank(a.severity);
    const sb = severityRank(b.severity);
    if (sa !== sb) return sa - sb;
    return `${a.slug ?? ''}:${a.code}`.localeCompare(`${b.slug ?? ''}:${b.code}`);
  });
}

export function formatProbeReportMarkdown(report: WcBetProbeReport): string {
  const lines: string[] = [
    '# WC Bet Probe Report',
    '',
    `- **Base:** ${report.baseUrl}`,
    `- **Mode:** ${report.mode}`,
    `- **Started:** ${report.startedAt}`,
    `- **Duration:** ${report.durationMs}ms`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Events scanned | ${report.summary.eventsScanned} |`,
    `| Outcomes collected | ${report.summary.outcomesCollected} |`,
    `| Outcomes probed | ${report.summary.outcomesProbed} |`,
    `| Bets placed | ${report.summary.betsPlaced} |`,
    `| Errors | ${report.summary.errors} |`,
    `| Warnings | ${report.summary.warnings} |`,
    '',
  ];

  const errors = report.findings.filter((f) => f.severity === 'error');
  const warnings = report.findings.filter((f) => f.severity === 'warning');

  if (errors.length) {
    lines.push('## Errors', '');
    for (const f of errors) {
      lines.push(formatFindingLine(f));
    }
    lines.push('');
  }

  if (warnings.length) {
    lines.push('## Warnings', '');
    for (const f of warnings) {
      lines.push(formatFindingLine(f));
    }
    lines.push('');
  }

  lines.push('## Events', '');
  for (const event of report.events) {
    lines.push(
      `- \`${event.slug}\` (${event.sport}, ${event.phase}) — candidates ${event.candidates}, probed ${event.probed}, placed ${event.placed}, smoke ${event.smokeOk ? 'OK' : 'FAIL'}`,
    );
  }

  if (report.mode === 'dry-run') {
    lines.push('', '_Dry-run: no real bets placed. Set `WC_BET_PROBE_TOKEN` + `WC_BET_PROBE_PLACE=1` for live user flow._');
  }

  return lines.join('\n');
}

function formatFindingLine(f: WcBetProbeFinding): string {
  const where = f.slug ? `[${f.slug}] ` : '';
  const market = f.outcomeKey
    ? ` \`${f.marketKey}/${f.outcomeKey}${f.line ? `@${f.line}` : ''}\``
    : '';
  const expect = f.expected != null || f.actual != null
    ? ` (expected=${f.expected ?? 'PENDING'}, actual=${f.actual ?? '-'})`
    : '';
  return `- **${f.code}** ${where}${f.message}${market}${expect}`;
}

export function writeProbeJsonReport(report: WcBetProbeReport, path: string): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function probeExitCode(report: WcBetProbeReport): number {
  return report.summary.errors > 0 ? 1 : 0;
}

const ACTION_HINTS: Record<string, string> = {
  set_total_premature_settlement: 'Проверить isMarketScopeFinalized для set totals',
  instant_settlement_while_pending_expected: 'Ставка закрылась мгновенно — баг settlement in-play',
  settlement_mismatch: 'Пересчитать WIN/LOSE по wc-verified-settlement',
  place_bet_rejected: 'UI показывает исход, API отклоняет — проверить placeBet / suspended',
  offered_while_betting_closed: 'Кoeff показываются при закрытых ставках',
  live_but_betting_closed: 'Live матч с bettingOpen=false',
  no_markets: 'Нет маркетов на событии',
};

/** Short alert body for Telegram bot. */
export function formatProbeTelegramAlert(report: WcBetProbeReport): string {
  const actionable = report.findings.filter((f) => f.severity === 'error' || f.severity === 'warning');
  const lines = [
    `Режим: ${report.mode}`,
    `Спорт(а): ${report.config.sport ?? 'all'}`,
    `Матчей: ${report.summary.eventsScanned}, ставок: ${report.summary.betsPlaced}`,
    `Ошибок: ${report.summary.errors}, предупреждений: ${report.summary.warnings}`,
    '',
    '⚠️ Нужно решить:',
  ];

  if (!actionable.length) {
    lines.push('(нет критичных находок — только info)');
  }

  for (const f of actionable.slice(0, 12)) {
    const hint = ACTION_HINTS[f.code] ?? f.code;
    const where = f.slug ? `[${f.slug}] ` : '';
    const market = f.outcomeKey
      ? ` ${f.marketKey}/${f.outcomeKey}${f.line ? `@${f.line}` : ''}`
      : '';
    lines.push(`• ${where}${f.message}${market}`);
    lines.push(`  → ${hint}`);
  }

  if (actionable.length > 12) {
    lines.push(`… ещё ${actionable.length - 12} находок`);
  }

  return lines.join('\n').slice(0, 3500);
}
