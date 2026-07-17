/** Lightweight WebAudio eat / boost beeps — no external assets. */

let ctx: AudioContext | null = null;
let muted = false;
let musicOn = false;
let musicNodes: { osc: OscillatorNode; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isSnakeMuted() {
  return muted;
}

export function setSnakeMuted(next: boolean) {
  muted = next;
  if (muted) stopMusic();
}

export function isSnakeMusicOn() {
  return musicOn;
}

export function unlockSnakeAudio() {
  const a = ac();
  if (!a) return;
  void a.resume();
}

export function setSnakeMusic(on: boolean) {
  musicOn = on;
  if (!on) {
    stopMusic();
    return;
  }
  unlockSnakeAudio();
  startMusic();
}

function stopMusic() {
  if (!musicNodes) return;
  try {
    musicNodes.osc.stop();
  } catch {
    /* already stopped */
  }
  musicNodes = null;
}

function startMusic() {
  if (muted || musicNodes) return;
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.value = 98;
  gain.gain.value = 0.018;
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start();
  musicNodes = { osc, gain };
}

function gated(): AudioContext | null {
  if (muted) return null;
  return ac();
}

export function playEatSound() {
  const a = gated();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660 + Math.random() * 180, t0);
  osc.frequency.exponentialRampToValueAtTime(920, t0 + 0.06);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

export function playBoostTickSound() {
  const a = gated();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.04, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.06);
}

export function playDieSound() {
  const a = gated();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(240, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.35);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.36);
}

export function playWinSound() {
  const a = gated();
  if (!a) return;
  const t0 = a.currentTime;
  [523, 659, 784].forEach((f, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = t0 + i * 0.08;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(start);
    osc.stop(start + 0.22);
  });
}
