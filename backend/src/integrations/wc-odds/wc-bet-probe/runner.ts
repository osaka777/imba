import { collectBettableOutcomes, pickSetTotalsCandidates } from './collect-outcomes';
import { configSnapshot, loadWcBetProbeConfig, sportsForConfig, type WcBetProbeConfig } from './config';
import { discoverEventSlugs, loadEventDetail } from './discover';
import { probeFetchStatus } from './http';
import {
  comparePlacedBetSettlement,
  validateSettlementLogic,
} from './settlement-check';
import {
  placeProbeBet,
  pollBetStatus,
  validateUiVsApiOffer,
} from './place-bet';
import {
  formatProbeReportMarkdown,
  formatProbeTelegramAlert,
  probeExitCode,
  sortFindings,
  writeProbeJsonReport,
} from './report';
import type {
  WcBetProbeCandidate,
  WcBetProbeEventResult,
  WcBetProbeFinding,
  WcBetProbeReport,
} from './types';
import { validateEventStructure } from './validators';

function countBySeverity(findings: WcBetProbeFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    infos: findings.filter((f) => f.severity === 'info').length,
  };
}

function prioritizeCandidates(candidates: WcBetProbeCandidate[]): WcBetProbeCandidate[] {
  const setTotals = pickSetTotalsCandidates(candidates);
  const keys = new Set(setTotals.map((c) => `${c.groupKey}:${c.outcome.outcomeKey}`));
  const rest = candidates.filter((c) => !keys.has(`${c.groupKey}:${c.outcome.outcomeKey}`));
  return [...setTotals, ...rest];
}

async function probeEvent(
  config: WcBetProbeConfig,
  slug: string,
  betsRemaining: { value: number },
): Promise<WcBetProbeEventResult> {
  const event = await loadEventDetail(config, slug);
  const grouped = event.groupedMarkets ?? {};
  const findings: WcBetProbeFinding[] = validateEventStructure(event);

  const bettingOpen = event.bettingOpen !== false && !event.completed;
  const candidates = prioritizeCandidates(
    collectBettableOutcomes(grouped, {
      bettingOpen,
      maxOutcomes: config.maxOutcomesPerEvent,
      includeWhenClosed: config.mode === 'dry-run',
    }),
  );

  let probed = 0;
  let placed = 0;

  for (const candidate of candidates) {
    probed += 1;
    const uiFinding = validateUiVsApiOffer(candidate, event.bettingOpen !== false, event.completed);
    if (uiFinding) {
      uiFinding.eventId = event.id;
      uiFinding.slug = event.slug;
      uiFinding.sport = event.sport;
      findings.push(uiFinding);
    }

    const settlementFindings = validateSettlementLogic(event, candidate);
    for (const f of settlementFindings) findings.push(f);

    if (config.mode !== 'live' || betsRemaining.value <= 0) continue;
    if (candidate.clientOdds < 1.05) continue;

    const placeResult = await placeProbeBet(config, event.id, candidate);
    if (placeResult.ok === false) {
      const finding = placeResult.finding;
      finding.slug = event.slug;
      finding.sport = event.sport;
      findings.push(finding);
      continue;
    }

    placed += 1;
    betsRemaining.value -= 1;

    const betId = placeResult.bet.id;
    if (!betId) continue;

    const polled = await pollBetStatus(config, betId, placeResult.placedAtMs);
    if (!polled) {
      findings.push({
        severity: 'info',
        code: 'bet_still_pending',
        message: `Placed bet #${betId} still pending after ${config.pollAfterBetMs}ms (expected for in-play).`,
        eventId: event.id,
        slug: event.slug,
        sport: event.sport,
        marketKey: candidate.marketKey,
        outcomeKey: candidate.outcome.outcomeKey,
        line: candidate.line,
      });
      continue;
    }

    findings.push(
      ...comparePlacedBetSettlement(
        event,
        candidate,
        polled.status,
        placeResult.placedAtMs,
        polled.observedAtMs,
        config.instantSettleMs,
      ),
    );
  }

  const smokeOk = !findings.some((f) => f.code.startsWith('smoke_'));
  return {
    slug: event.slug,
    eventId: event.id,
    sport: event.sport,
    phase: event.phase,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    bettingOpen: event.bettingOpen,
    completed: event.completed,
    marketsCount: event.marketsCount ?? 0,
    smokeOk,
    candidates: candidates.length,
    probed,
    placed,
    findings,
  };
}

export async function runWcBetProbe(config: WcBetProbeConfig = loadWcBetProbeConfig()): Promise<WcBetProbeReport> {
  const startedAt = new Date();
  const allFindings: WcBetProbeFinding[] = [];
  const eventResults: WcBetProbeEventResult[] = [];

  if (config.skip) {
    const finishedAt = new Date();
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      baseUrl: config.baseUrl,
      mode: config.mode,
      config: configSnapshot(config),
      summary: {
        eventsScanned: 0,
        outcomesCollected: 0,
        outcomesProbed: 0,
        betsPlaced: 0,
        errors: 0,
        warnings: 0,
        infos: 0,
      },
      events: [],
      findings: [],
    };
  }

  const status = await probeFetchStatus(config);
  if (!status.enabled) {
    throw new Error(`WC feed disabled at ${config.baseUrl}`);
  }

  if (config.mode === 'live' && !config.token) {
    throw new Error('WC_BET_PROBE_TOKEN is required when WC_BET_PROBE_PLACE=1');
  }

  const slugs = await discoverEventSlugs(config);
  if (!slugs.length) {
    if (config.sport && config.sport !== 'all') {
      return {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        baseUrl: config.baseUrl,
        mode: config.mode,
        config: configSnapshot(config),
        summary: {
          eventsScanned: 0,
          outcomesCollected: 0,
          outcomesProbed: 0,
          betsPlaced: 0,
          errors: 0,
          warnings: 1,
          infos: 0,
        },
        events: [],
        findings: [{
          severity: 'warning',
          code: 'no_live_events_for_sport',
          message: `No live/line events with marketsCount >= ${config.minMarkets} for sport=${config.sport}`,
          sport: config.sport,
        }],
      };
    }
    throw new Error(
      `No events with marketsCount >= ${config.minMarkets} found (sport=${config.sport || 'any'})`,
    );
  }

  const betsRemaining = { value: config.maxBetsPerRun };

  for (const slug of slugs) {
    const result = await probeEvent(config, slug, betsRemaining);
    eventResults.push(result);
    allFindings.push(...result.findings);
  }

  const sorted = sortFindings(allFindings);
  const counts = countBySeverity(sorted);
  const finishedAt = new Date();

  const report: WcBetProbeReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    baseUrl: config.baseUrl,
    mode: config.mode,
    config: configSnapshot(config),
    summary: {
      eventsScanned: eventResults.length,
      outcomesCollected: eventResults.reduce((sum, e) => sum + e.candidates, 0),
      outcomesProbed: eventResults.reduce((sum, e) => sum + e.probed, 0),
      betsPlaced: eventResults.reduce((sum, e) => sum + e.placed, 0),
      errors: counts.errors,
      warnings: counts.warnings,
      infos: counts.infos,
    },
    events: eventResults,
    findings: sorted,
  };

  if (config.reportJsonPath) {
    writeProbeJsonReport(report, config.reportJsonPath);
  }

  return report;
}

function mergeReports(base: WcBetProbeReport, next: WcBetProbeReport): WcBetProbeReport {
  const findings = sortFindings([...base.findings, ...next.findings]);
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const infos = findings.filter((f) => f.severity === 'info').length;
  const finishedAt = next.finishedAt;

  return {
    ...base,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(base.startedAt).getTime(),
    summary: {
      eventsScanned: base.summary.eventsScanned + next.summary.eventsScanned,
      outcomesCollected: base.summary.outcomesCollected + next.summary.outcomesCollected,
      outcomesProbed: base.summary.outcomesProbed + next.summary.outcomesProbed,
      betsPlaced: base.summary.betsPlaced + next.summary.betsPlaced,
      errors,
      warnings,
      infos,
    },
    events: [...base.events, ...next.events],
    findings,
  };
}

/** Run probe across soccer, tennis, volleyball, etc. */
export async function runWcBetProbeAllSports(
  config: WcBetProbeConfig = loadWcBetProbeConfig(),
): Promise<WcBetProbeReport> {
  const sports = sportsForConfig(config);
  if (sports.length <= 1 && !config.eventSlug) {
    return runWcBetProbe({ ...config, sport: sports[0] ?? config.sport });
  }
  if (config.eventSlug) {
    return runWcBetProbe(config);
  }

  let merged: WcBetProbeReport | null = null;
  for (const sport of sports) {
    const sportReport = await runWcBetProbe({ ...config, sport });
    merged = merged ? mergeReports(merged, sportReport) : sportReport;
  }
  return merged!;
}

export async function runWcBetProbeCli(): Promise<{ exitCode: number; report?: WcBetProbeReport }> {
  const config = loadWcBetProbeConfig();
  try {
    const report = config.eventSlug || sportsForConfig(config).length <= 1
      ? await runWcBetProbe(config)
      : await runWcBetProbeAllSports(config);
    const markdown = formatProbeReportMarkdown(report);
    console.log(markdown);
    if (config.reportJsonPath) {
      console.log(`\nJSON report: ${config.reportJsonPath}`);
    }
    if (config.verbose) {
      console.log('\n--- verbose findings ---');
      console.log(JSON.stringify(report.findings, null, 2));
    }
    return { exitCode: probeExitCode(report), report };
  } catch (err) {
    console.error(`WC bet probe failed: ${(err as Error).message}`);
    return { exitCode: 2 };
  }
}

export { loadWcBetProbeConfig, configSnapshot } from './config';
export type { WcBetProbeConfig } from './config';
export type {
  WcBetProbeReport,
  WcBetProbeFinding,
  WcBetProbeEventResult,
} from './types';
