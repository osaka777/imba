#!/usr/bin/env ts-node
/**
 * WC user-flow bet probe — simulates a real bettor on imba.bet / WC feed.
 *
 * Dry-run (default): structural + settlement logic checks, no real bets.
 * Live mode: WC_BET_PROBE_TOKEN + WC_BET_PROBE_PLACE=1
 *
 * Env:
 *   WC_BET_PROBE_BASE_URL     default https://imba.bet
 *   WC_BET_PROBE_EVENT_SLUG   fixed event, e.g. 21-vs-21-8278479
 *   WC_BET_PROBE_SPORT        default volleyball
 *   WC_BET_PROBE_PLACE=1      place real min-stake bets
 *   WC_BET_PROBE_TOKEN        user JWT (not superuser)
 *   WC_BET_PROBE_MAX_BETS     default 2
 *   WC_BET_PROBE_JSON         write JSON report path
 *   WC_BET_PROBE_SKIP=1       no-op exit 0
 */
import { runWcBetProbeCli } from '../src/integrations/wc-odds/wc-bet-probe';

runWcBetProbeCli().then(({ exitCode }) => process.exit(exitCode));
