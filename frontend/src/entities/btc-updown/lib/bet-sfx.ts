/** Bet SFX for BTC Up/Down. */

const CLICK_SRC = "/sounds/click.mp3";
const WIN_SRC = "/sounds/win.mp3";
const LOSE_SRC = "/sounds/lose.mp3";

let unlocked = false;
let shared: HTMLAudioElement | null = null;

function getShared(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!shared) {
    shared = new Audio(CLICK_SRC);
    shared.preload = "auto";
    shared.volume = 0.85;
  }
  return shared;
}

function playSrc(src: string, volume = 0.9) {
  if (typeof window === "undefined") return;
  try {
    const a = new Audio(src);
    a.volume = volume;
    const p = a.play();
    if (p && typeof p.catch === "function") {
      void p.catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Must run inside a user gesture (click). Unlocks autoplay so later
 * plays (e.g. after settle) are allowed in most browsers.
 */
export function unlockBetClickSound() {
  if (typeof window === "undefined" || unlocked) return;
  const a = getShared();
  if (!a) return;
  a.muted = true;
  void a
    .play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
    })
    .catch(() => {
      a.muted = false;
    });
}

/**
 * Call synchronously from a click handler — before any await.
 * Fresh Audio() each time so rapid bets don't collide on one element.
 */
export function playBetClickSound() {
  playSrc(CLICK_SRC, 0.85);
}

/** Settlement — win. Prefers unlocked gesture from earlier bet click. */
export function playBetWinSound() {
  playSrc(WIN_SRC, 0.9);
}

/** Settlement — lose. */
export function playBetLoseSound() {
  playSrc(LOSE_SRC, 0.9);
}
