const DAY_MS = 24 * 60 * 60 * 1000;

export type KickoffCountdownParts = {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  started: boolean;
};

export function getKickoffCountdownParts(
  commenceTime: string,
  nowMs: number = Date.now(),
): KickoffCountdownParts {
  const kickoffMs = Date.parse(commenceTime);
  const totalMs = Number.isFinite(kickoffMs) ? Math.max(0, kickoffMs - nowMs) : 0;
  const totalSec = Math.floor(totalMs / 1000);

  return {
    totalMs,
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    started: totalMs === 0,
  };
}

export function padCountdownUnit(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatKickoffCountdownHuman(totalMs: number): string | null {
  if (totalMs <= 0) return null;

  const hours = Math.floor(totalMs / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);

  if (days >= 2) return `через ${days} дн`;
  if (days === 1) return "через 1 дн";
  if (hours >= 1) return `через ${hours} ч`;
  const minutes = Math.floor(totalMs / (60 * 1000));
  if (minutes >= 1) return `через ${minutes} мин`;
  return "скоро";
}

export function shouldShowKickoffTicker(totalMs: number): boolean {
  return totalMs > 0 && totalMs <= 7 * DAY_MS;
}
