import {
  formatProbeReportMarkdown,
  loadWcBetProbeConfig,
  probeExitCode,
  runWcBetProbe,
} from '../src/integrations/wc-odds/wc-bet-probe';

const SKIP = process.env.WC_BET_PROBE_SKIP === '1';

(SKIP ? describe.skip : describe)('WC bet probe (user flow)', () => {
  it('completes dry-run without structural errors on live feed', async () => {
    const config = loadWcBetProbeConfig();
    config.mode = 'dry-run';
    config.maxEvents = Number(process.env.WC_BET_PROBE_MAX_EVENTS || '2');
    config.maxOutcomesPerEvent = Number(process.env.WC_BET_PROBE_MAX_OUTCOMES || '6');
    config.maxBetsPerRun = 0;

    if (process.env.WC_BET_PROBE_EVENT_SLUG) {
      config.eventSlug = process.env.WC_BET_PROBE_EVENT_SLUG;
    } else {
      config.eventSlug = '';
      config.sport = process.env.WC_BET_PROBE_SPORT || 'volleyball';
    }

    const report = await runWcBetProbe(config);
    const markdown = formatProbeReportMarkdown(report);

    if (report.summary.errors > 0) {
      throw new Error(
        `Bet probe found ${report.summary.errors} error(s):\n${markdown}`,
      );
    }

    expect(report.summary.eventsScanned).toBeGreaterThan(0);
    expect(probeExitCode(report)).toBe(0);

    const hasLiveCandidates = report.events.some((e) => e.candidates > 0 && e.phase === 'live');
    const hasAuditCandidates = report.summary.outcomesProbed > 0;
    expect(hasLiveCandidates || hasAuditCandidates || config.eventSlug).toBeTruthy();
  }, Number(process.env.WC_BET_PROBE_TIMEOUT_MS || '120000'));
});
import {
  formatProbeReportMarkdown,
  loadWcBetProbeConfig,
  probeExitCode,
  runWcBetProbe,
} from '../src/integrations/wc-odds/wc-bet-probe';

const SKIP = process.env.WC_BET_PROBE_SKIP === '1';

(SKIP ? describe.skip : describe)('WC bet probe (user flow)', () => {
  it('completes dry-run without structural errors on live feed', async () => {
    const config = loadWcBetProbeConfig();
    config.mode = 'dry-run';
    config.maxEvents = Number(process.env.WC_BET_PROBE_MAX_EVENTS || '2');
    config.maxOutcomesPerEvent = Number(process.env.WC_BET_PROBE_MAX_OUTCOMES || '6');
    config.maxBetsPerRun = 0;

    if (process.env.WC_BET_PROBE_EVENT_SLUG) {
      config.eventSlug = process.env.WC_BET_PROBE_EVENT_SLUG;
    } else {
      config.eventSlug = '';
      config.sport = process.env.WC_BET_PROBE_SPORT || 'volleyball';
    }

    const report = await runWcBetProbe(config);
    const markdown = formatProbeReportMarkdown(report);

    if (report.summary.errors > 0) {
      throw new Error(
        `Bet probe found ${report.summary.errors} error(s):\n${markdown}`,
      );
    }

    expect(report.summary.eventsScanned).toBeGreaterThan(0);
    expect(probeExitCode(report)).toBe(0);

    const hasLiveCandidates = report.events.some((e) => e.candidates > 0 && e.phase === 'live');
    const hasAuditCandidates = report.summary.outcomesProbed > 0;
    expect(hasLiveCandidates || hasAuditCandidates || config.eventSlug).toBeTruthy();
  }, Number(process.env.WC_BET_PROBE_TIMEOUT_MS || '120000'));
});
