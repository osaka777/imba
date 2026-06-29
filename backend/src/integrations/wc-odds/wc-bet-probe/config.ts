import type { WcBetProbeMode } from './types';
import { resolveProbeSports } from './sports';

export type WcBetProbeConfig = {
  baseUrl: string;
  mode: WcBetProbeMode;
  eventSlug: string;
  sport: string;
  minMarkets: number;
  maxEvents: number;
  maxOutcomesPerEvent: number;
  maxBetsPerRun: number;
  stake: number;
  currencyCode: string;
  token: string;
  timeoutMs: number;
  instantSettleMs: number;
  pollAfterBetMs: number;
  acceptOddsChange: boolean;
  skip: boolean;
  reportJsonPath: string;
  verbose: boolean;
  probeUserId: number;
  probeSecret: string;
};

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return fallback;
}

export function loadWcBetProbeConfig(): WcBetProbeConfig {
  const placeLive = envBool('WC_BET_PROBE_PLACE', false);
  const token = process.env.WC_BET_PROBE_TOKEN?.trim() || '';

  return {
    baseUrl: (process.env.WC_BET_PROBE_BASE_URL || process.env.WC_SMOKE_BASE_URL || 'https://imba.bet').replace(/\/$/, ''),
    mode: placeLive && token ? 'live' : 'dry-run',
    eventSlug: process.env.WC_BET_PROBE_EVENT_SLUG?.trim() || '',
    sport: process.env.WC_BET_PROBE_SPORT?.trim() || 'all',
    minMarkets: Number(process.env.WC_BET_PROBE_MIN_MARKETS || process.env.WC_SMOKE_MIN_MARKETS || '3'),
    maxEvents: Number(process.env.WC_BET_PROBE_MAX_EVENTS || '3'),
    maxOutcomesPerEvent: Number(process.env.WC_BET_PROBE_MAX_OUTCOMES || '8'),
    maxBetsPerRun: Number(process.env.WC_BET_PROBE_MAX_BETS || '2'),
    stake: Number(process.env.WC_BET_PROBE_STAKE || '100'),
    currencyCode: process.env.WC_BET_PROBE_CURRENCY || 'KZT',
    token,
    timeoutMs: Number(process.env.WC_BET_PROBE_TIMEOUT_MS || '45000'),
    instantSettleMs: Number(process.env.WC_BET_PROBE_INSTANT_MS || '2500'),
    pollAfterBetMs: Number(process.env.WC_BET_PROBE_POLL_MS || '8000'),
    acceptOddsChange: envBool('WC_BET_PROBE_ACCEPT_ODDS', true),
    skip: envBool('WC_BET_PROBE_SKIP', false),
    reportJsonPath: process.env.WC_BET_PROBE_JSON?.trim() || '',
    verbose: envBool('WC_BET_PROBE_VERBOSE', false),
    probeUserId: Number(process.env.WC_BET_PROBE_USER_ID || '0'),
    probeSecret:
      process.env.WC_PROBE_SECRET?.trim()
      || process.env.TELEGRAM_NOTIFY_SECRET?.trim()
      || '',
  };
}

export function sportsForConfig(config: WcBetProbeConfig): string[] {
  if (config.eventSlug) return [config.sport === 'all' ? 'soccer' : config.sport];
  return resolveProbeSports(config.sport);
}

export function configSnapshot(config: WcBetProbeConfig): Record<string, string | number | boolean> {
  return {
    baseUrl: config.baseUrl,
    mode: config.mode,
    eventSlug: config.eventSlug || '(auto)',
    sport: config.sport,
    minMarkets: config.minMarkets,
    maxEvents: config.maxEvents,
    maxOutcomesPerEvent: config.maxOutcomesPerEvent,
    maxBetsPerRun: config.maxBetsPerRun,
    stake: config.stake,
    hasToken: Boolean(config.token),
    instantSettleMs: config.instantSettleMs,
  };
}
