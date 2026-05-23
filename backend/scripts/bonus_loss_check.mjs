// Usage:
//   BASE_URL=http://localhost:3000 \
//   EMAIL=test@test.com PASSWORD=closeD \
//   EVENT_ID=<eventId> CURRENCY=KZT STAKE=1 \
//   GN=<groupNumber> ON=<outcomeNumber> NO=0 ODDS=1.9 \
//   ACCOUNT_TYPE=main node backend/scripts/bonus_loss_check.mjs
//
// Notes:
// - If GN/ON/NO/ODDS are not provided, the script will try to fetch /game/:eventId and pick the first available numeric market; if it fails, it will exit with instructions.
// - ACCOUNT_TYPE: "main" (default) or "bonus". When "bonus", backend enforces minOdds and uses bonus balance.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.EMAIL || 'test@test.com';
const PASSWORD = process.env.PASSWORD || 'closeD';
const EVENT_ID = process.env.EVENT_ID; // required unless script auto-finds
const CURRENCY = process.env.CURRENCY || 'KZT';
const STAKE = Number(process.env.STAKE || '1');
const GN = process.env.GN ? Number(process.env.GN) : undefined; // groupNumber
const ON = process.env.ON ? Number(process.env.ON) : undefined; // outcomeNumber
const NO = process.env.NO !== undefined ? Number(process.env.NO) : 0; // numericOutcome
const ODDS = process.env.ODDS ? Number(process.env.ODDS) : undefined; // odds
const ACCOUNT_TYPE = (process.env.ACCOUNT_TYPE || 'main').toLowerCase(); // 'main' or 'bonus'
const MODE_SIMULATE = 'simulate'

if (!globalThis.fetch) {
  // Node 18+ has fetch; if not present, advise
  console.error('This script requires Node.js v18+ (global fetch).');
  process.exit(1);
}

async function simulateLoseViaApi(token, params) {
  const url = new URL('/api/test/simulate-lose', BASE_URL).toString();
  const payload = {
    amount: STAKE,
    currency: CURRENCY,
    eventId: params.eventId,
    odds: params.odds || 1.9,
    accountType: ACCOUNT_TYPE === 'bonus' ? 'bonus' : 'main',
  };
  const data = await jsonFetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return data; // { success, betId, status: 'LOSE' }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const body = contentType.includes('application/json') ? await res.json().catch(() => ({})) : { text: await res.text().catch(() => '') };
    throw new Error(`HTTP ${res.status} ${res.statusText} at ${url}: ${JSON.stringify(body).slice(0,500)}`);
  }
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON from ${url}, got ${contentType}. First 200 chars: ${text.slice(0,200)}`);
  }
  return res.json();
}

async function signIn() {
  const url = new URL('/api/sign-in', BASE_URL).toString();
  const data = await jsonFetch(url, {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!data?.accessToken) throw new Error('No accessToken in sign-in response');
  return data.accessToken;
}

async function getFirstLiveGame(token) {
  const url = new URL('/api/games/live?limit=1', BASE_URL).toString();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (Array.isArray(data) && data.length > 0) return data[0];
  return null;
}

function tryExtractFirstNumericMarket(groupedMarkets) {
  // groupedMarkets structure depends on transform; attempt generic scan
  if (!groupedMarkets || typeof groupedMarkets !== 'object') return null;
  for (const groupKey of Object.keys(groupedMarkets)) {
    const group = groupedMarkets[groupKey];
    if (!group) continue;
    const markets = Array.isArray(group) ? group : Array.isArray(group?.markets) ? group.markets : Object.values(group || {});
    const list = Array.isArray(markets) ? markets : [];
    for (const m of list) {
      const outcomes = Array.isArray(m?.outcomes) ? m.outcomes : [];
      for (const o of outcomes) {
        // Expect numeric codes present in meta if exposed
        const gn = Number(m?.groupNumber ?? m?.gn ?? m?.code ?? m?.group_code);
        const on = Number(o?.outcomeNumber ?? o?.on ?? o?.code ?? o?.outcome_code);
        const no = Number(o?.numericOutcome ?? o?.no ?? 0);
        const odds = Number(o?.odds ?? o?.cf ?? o?.coef ?? o?.coefficient);
        if (Number.isFinite(gn) && Number.isFinite(on) && Number.isFinite(odds) && odds > 0) {
          return { groupNumber: gn, outcomeNumber: on, numericOutcome: Number.isFinite(no) ? no : 0, odds };
        }
      }
    }
  }
  return null;
}

async function getGameAndPickMarket(eventId, token) {
  const url = new URL(`/api/game/${encodeURIComponent(eventId)}`, BASE_URL).toString();
  const data = await jsonFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const pick = tryExtractFirstNumericMarket(data?.groupedMarkets);
  if (!pick) {
    throw new Error('Failed to automatically extract numeric market codes (groupNumber/outcomeNumber/odds). Provide GN, ON, NO, ODDS env vars.');
  }
  return pick;
}

async function placeBet(token, params) {
  const url = new URL('/api/bet', BASE_URL).toString();
  const body = {
    eventId: params.eventId,
    groupNumber: params.groupNumber,
    outcomeNumber: params.outcomeNumber,
    numericOutcome: params.numericOutcome ?? 0,
    odds: params.odds,
    stake: STAKE,
    currency: CURRENCY,
    accountType: ACCOUNT_TYPE === 'bonus' ? 'bonus' : undefined,
  };
  const data = await jsonFetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!data?.success) throw new Error(`Bet placement failed: ${JSON.stringify(data).slice(0,500)}`);
  return data; // { success, betId, status, potentialPayout, ... }
}

async function forceLose(betId) {
  // Send BetAPI-like callback to /bet/result
  // Service accepts BetCode in KeyHead.BarCode or BetCode field; use betId returned by /bet which is betCode when available
  const url = new URL('/api/bet/result', BASE_URL).toString();
  const payload = {
    KeyHead: { BarCode: String(betId) },
    Status: 4, // map to LOSE in service.getOutcomeType
    ExtStatus: 0,
    AmountOut: 0,
  };
  const res = await jsonFetch(url, { method: 'POST', body: JSON.stringify(payload) });
  return res;
}

async function fetchBonusAndBets(token) {
  const historyUrl = new URL('/api/bonus-balance/history', BASE_URL).toString();
  const userBonusUrl = new URL('/api/bonus-balance/user', BASE_URL).toString();
  const betsLoseUrl = new URL('/api/bet?status=LOSE', BASE_URL).toString();

  const [history, balances, loseBets] = await Promise.all([
    jsonFetch(historyUrl, { headers: { Authorization: `Bearer ${token}` } }).catch(() => []),
    jsonFetch(userBonusUrl, { headers: { Authorization: `Bearer ${token}` } }).catch(() => []),
    jsonFetch(betsLoseUrl, { headers: { Authorization: `Bearer ${token}` } }).catch(() => []),
  ]);

  return { history, balances, loseBets };
}

(async () => {
  try {
    console.log('🔐 Signing in...');
    const token = await signIn();
    console.log('✅ Signed in');

    let eventId = EVENT_ID;
    if (!eventId) {
      if (MODE_SIMULATE) {
        // In simulate mode, allow default test event id
        eventId = 'TEST';
        console.log('🎯 MODE=simulate: using default eventId=TEST');
      } else {
        console.log('🎯 EVENT_ID not provided. Trying to pick first live game...');
        const game = await getFirstLiveGame(token);
        if (!game?.eventId) throw new Error('Could not find a live game. Provide EVENT_ID.');
        eventId = game.eventId;
        console.log('➡️ Using eventId:', eventId);
      }
    }

    let groupNumber = GN;
    let outcomeNumber = ON;
    let numericOutcome = NO ?? 0;
    let odds = ODDS;

    if (!MODE_SIMULATE) {
      if (!Number.isFinite(groupNumber) || !Number.isFinite(outcomeNumber) || !Number.isFinite(odds)) {
        console.log('🧭 GN/ON/ODDS not fully provided. Trying to extract from /api/game/:eventId ...');
        const pick = await getGameAndPickMarket(eventId, token);
        groupNumber = pick.groupNumber;
        outcomeNumber = pick.outcomeNumber;
        numericOutcome = pick.numericOutcome;
        odds = pick.odds;
        console.log('✅ Picked market:', { groupNumber, outcomeNumber, numericOutcome, odds });
      }
    } else {
      // Simulate mode: only need odds for display; backend endpoint sets LOSE directly
      if (!Number.isFinite(odds)) odds = 1.9;
    }

    let finalBetId = null;
    if (MODE_SIMULATE) {
      console.log('🧪 Simulating LOSE via /api/test/simulate-lose...', { eventId, odds, STAKE, CURRENCY, accountType: ACCOUNT_TYPE });
      const sim = await simulateLoseViaApi(token, { eventId, odds });
      console.log('✅ Simulated LOSE bet:', sim);
      finalBetId = sim?.betId || null;
    } else {
      console.log('🎰 Placing bet...', { eventId, groupNumber, outcomeNumber, numericOutcome, odds, STAKE, CURRENCY, accountType: ACCOUNT_TYPE });
      const bet = await placeBet(token, { eventId, groupNumber, outcomeNumber, numericOutcome, odds });
      console.log('✅ Bet placed:', { betId: bet.betId, status: bet.status, potentialPayout: bet.potentialPayout, coefficientChanged: bet.coefficientChanged, originalCoefficient: bet.originalCoefficient, actualCoefficient: bet.actualCoefficient });

      console.log('⏳ Waiting 1s before forcing LOSE...');
      await sleep(1000);

      console.log('🛑 Forcing LOSE via /bet/result...');
      const result = await forceLose(bet.betId);
      console.log('✅ Callback processed:', result);
      finalBetId = bet.betId;
    }

    console.log('📊 Fetching bonus history, balances, and LOSE bets...');
    const data = await fetchBonusAndBets(token);
    console.log('— Bonus history items:', Array.isArray(data.history) ? data.history.length : 0);
    console.log('— Active bonus balances:', Array.isArray(data.balances) ? data.balances.length : 0);
    console.log('— LOSE bets count:', Array.isArray(data.loseBets?.ordinar) ? data.loseBets.ordinar.length : (Array.isArray(data.loseBets) ? data.loseBets.length : 0));

    console.log('\n=== Summary ===');
    console.log(JSON.stringify({
      eventId,
      betId: finalBetId,
      bonusHistoryCount: Array.isArray(data.history) ? data.history.length : 0,
      bonusBalances: data.balances,
      loseBets: data.loseBets,
    }, null, 2));

    console.log('\n✅ Done');
  } catch (err) {
    console.error('\n❌ Error:', err?.message || err);
    process.exit(1);
  }
})();
