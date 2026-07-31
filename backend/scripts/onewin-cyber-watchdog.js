#!/usr/bin/env node
/**
 * Detects when cybersport push-feed is starved (odds/list OK, streams gone)
 * while 1win itself still has broadcast URLs — then restarts onex-backend.
 *
 * Run via cron wrapper (host). Uses docker exec into the backend container.
 */
"use strict";

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONTAINER = process.env.ONEWIN_WD_CONTAINER || "onex-backend-1";
const LOG_DIR = process.env.ONEWIN_WD_LOG_DIR || "/home/kendall-stack/logs";
const STATE_FILE =
  process.env.ONEWIN_WD_STATE || path.join(LOG_DIR, "onewin-cyber-watchdog.state.json");
const COOLDOWN_MS = Number(process.env.ONEWIN_WD_COOLDOWN_MS || 10 * 60_000);
const MIN_LIVE = Number(process.env.ONEWIN_WD_MIN_LIVE || 3);
const PROBE_TIMEOUT_MS = Number(process.env.ONEWIN_WD_PROBE_MS || 7_000);

function log(msg) {
  process.stdout.write(`${new Date().toISOString()} ${msg}\n`);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(patch) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(next, null, 2)}\n`);
}

function containerRunning() {
  try {
    const out = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf8",
    });
    return out.split("\n").includes(CONTAINER);
  } catch {
    return false;
  }
}

function fetchLiveInside() {
  const script = `
(async () => {
  const live = await (await fetch('http://127.0.0.1:3000/api/cybersport/live?limit=16')).json();
  if (!Array.isArray(live)) {
    console.log(JSON.stringify({ error: 'bad_payload', live: 0, withBroadcast: 0, matchIds: [] }));
    return;
  }
  const withBroadcast = live.filter((g) =>
    g?.meta?.hasBroadcast || g?.meta?.oneWinBroadcastUrl
  ).length;
  const matchIds = live
    .map((g) => g?.meta?.matchId)
    .filter((id) => Number.isFinite(id))
    .slice(0, 8);
  console.log(JSON.stringify({ live: live.length, withBroadcast, matchIds }));
})().catch((e) => {
  console.log(JSON.stringify({ error: String(e && e.message || e), live: 0, withBroadcast: 0, matchIds: [] }));
});
`;
  const r = spawnSync(
    "docker",
    ["exec", CONTAINER, "node", "-e", script],
    { encoding: "utf8", timeout: 45_000 },
  );
  if (r.status !== 0) {
    throw new Error(`live fetch failed: ${(r.stderr || r.stdout || "").slice(0, 240)}`);
  }
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

function probeOneWinMedia(matchIds) {
  if (!matchIds.length) return { probed: 0, withBroadcast: 0 };
  const idsJson = JSON.stringify(matchIds);
  const script = `
const { io } = require('socket.io-client');
(async () => {
  const ids = ${idsJson};
  const partner = process.env.ONEWIN_PARTNER_ID || '44ba10e5-7df2-47ab-a44d-dc93803c7a6e';
  const snaps = new Map();
  const socket = io('wss://api-gateway.top-parser.com', {
    path: '/push-server-v2/',
    query: { Language: 'ru-RU', externalPartnerId: partner },
    transports: ['websocket'],
    reconnection: false,
  });
  await new Promise((resolve) => {
    const t = setTimeout(() => { try { socket.close(); } catch {} resolve(); }, ${PROBE_TIMEOUT_MS});
    socket.on('connect', () => {
      socket.emit('subscribe', { data: { matchIds: ids }, messageType: 'subscribe-match-info' });
    });
    socket.on('u', (msg) => {
      if (msg?.messageType !== 'match-info-snapshot' && msg?.messageType !== 'match-info') return;
      const d = msg.data;
      if (!d?.matchId) return;
      snaps.set(d.matchId, Boolean(d.broadcast?.url || d.statisticsTracker?.url || d.liveTracker?.url));
      if (snaps.size >= ids.length) { clearTimeout(t); try { socket.close(); } catch {} resolve(); }
    });
    socket.on('connect_error', () => { clearTimeout(t); try { socket.close(); } catch {} resolve(); });
  });
  let withBroadcast = 0;
  for (const v of snaps.values()) if (v) withBroadcast += 1;
  console.log(JSON.stringify({ probed: snaps.size, withBroadcast }));
})().catch((e) => {
  console.log(JSON.stringify({ error: String(e && e.message || e), probed: 0, withBroadcast: 0 }));
});
`;
  const r = spawnSync(
    "docker",
    ["exec", CONTAINER, "node", "-e", script],
    { encoding: "utf8", timeout: PROBE_TIMEOUT_MS + 8_000 },
  );
  if (r.status !== 0) {
    throw new Error(`1win probe failed: ${(r.stderr || r.stdout || "").slice(0, 240)}`);
  }
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

function sleepMs(ms) {
  const sec = Math.max(1, Math.ceil(ms / 1000));
  spawnSync("sleep", [String(sec)], { encoding: "utf8" });
}

function restartBackend() {
  log(`RESTART ${CONTAINER}`);
  const r = spawnSync("docker", ["restart", CONTAINER], {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (r.status !== 0) {
    throw new Error(`docker restart failed: ${(r.stderr || r.stdout || "").slice(0, 240)}`);
  }
  for (let i = 0; i < 30; i++) {
    sleepMs(2_000);
    try {
      const check = spawnSync(
        "docker",
        [
          "exec",
          CONTAINER,
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(t=>console.log(t)).catch(e=>{console.error(e);process.exit(1)})",
        ],
        { encoding: "utf8", timeout: 10_000 },
      );
      if (check.status === 0 && /ok/i.test(check.stdout || "")) return;
    } catch {
      /* retry */
    }
  }
  log("WARN: backend restarted but health not confirmed yet");
}

function main() {
  if (!containerRunning()) {
    log(`SKIP: container ${CONTAINER} not running`);
    process.exit(0);
  }

  const liveInfo = fetchLiveInside();
  if (liveInfo.error) {
    log(`WARN: live API error: ${liveInfo.error}`);
  }

  const { live = 0, withBroadcast = 0, matchIds = [] } = liveInfo;
  log(`CHECK live=${live} withBroadcast=${withBroadcast}`);

  if (live < MIN_LIVE) {
    log(`OK: not enough live matches to judge (need >= ${MIN_LIVE})`);
    writeState({ lastOkAt: new Date().toISOString(), live, withBroadcast, action: "skip_low_live" });
    return;
  }

  // Healthy enough: majority of live cyber matches already have media.
  // Old 15% threshold let starved feeds (e.g. 4/16) look "OK".
  if (withBroadcast > 0 && withBroadcast / live >= 0.6) {
    log("OK: media present");
    writeState({ lastOkAt: new Date().toISOString(), live, withBroadcast, action: "ok" });
    return;
  }

  log("SUSPECT: media coverage low — probing 1win socket");
  const probe = probeOneWinMedia(matchIds);
  log(`PROBE probed=${probe.probed} withBroadcast=${probe.withBroadcast}${probe.error ? ` error=${probe.error}` : ""}`);

  // 1win has meaningfully more media than we do → our push-feed is starved
  const ourRatio = withBroadcast / live;
  const probeRatio = probe.probed > 0 ? probe.withBroadcast / probe.probed : 0;
  if (!probe.withBroadcast || probeRatio <= ourRatio + 0.15) {
    log("OK: 1win coverage not clearly better than ours");
    writeState({
      lastOkAt: new Date().toISOString(),
      live,
      withBroadcast,
      probe,
      action: "ok_no_source_gap",
    });
    return;
  }

  // Our API starved while 1win has streams → heal
  const state = readState();
  const lastRestart = Number(state.lastRestartAtMs || 0);
  if (Date.now() - lastRestart < COOLDOWN_MS) {
    log(`SKIP restart: cooldown ${Math.round((COOLDOWN_MS - (Date.now() - lastRestart)) / 1000)}s left`);
    writeState({
      lastSuspectAt: new Date().toISOString(),
      live,
      withBroadcast,
      probe,
      action: "cooldown",
    });
    return;
  }

  restartBackend();
  sleepMs(8_000);
  const after = fetchLiveInside();
  log(`AFTER live=${after.live} withBroadcast=${after.withBroadcast}`);
  writeState({
    lastRestartAtMs: Date.now(),
    lastRestartAt: new Date().toISOString(),
    live,
    withBroadcast,
    probe,
    after,
    action: "restarted",
  });
}

try {
  main();
} catch (err) {
  log(`ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
