import type { OlimpbetInlineStat } from './wc-odds-statistics.types';

function inlineStatValue(
  stats: OlimpbetInlineStat[] | null | undefined,
  code: string,
): string | null {
  const row = (stats ?? []).find((s) => s.code === code);
  const value = row?.value;
  return value != null && String(value).trim() !== '' ? String(value).trim() : null;
}

/** Parse "+3", "3", 3, or milliseconds-ish values into whole minutes. */
export function parseOlimpbetMinutes(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return null;
    if (raw >= 60_000) return Math.round(raw / 60_000);
    return Math.round(raw);
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const fromText = trimmed.match(/^\+?\s*(\d{1,2})\s*'?/);
  if (fromText) {
    const minutes = Number(fromText[1]);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    if (asNumber >= 60_000) return Math.round(asNumber / 60_000);
    return Math.round(asNumber);
  }

  return null;
}

/** Referee-announced added time: inline `add_minutes`, then structured `additionalMinutes`. */
export function parseAnnouncedAddedMinutes(
  inline: OlimpbetInlineStat[] | null | undefined,
  common?: Record<string, unknown> | null,
): number | null {
  const fromInline = parseOlimpbetMinutes(inlineStatValue(inline, 'add_minutes'));
  if (fromInline != null) return fromInline;
  return parseOlimpbetMinutes(common?.additionalMinutes);
}

/** Olimpbet duration fields are usually milliseconds; normalize to seconds. */
export function parseOlimpbetDurationSeconds(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 60_000) return Math.round(n / 1000);
  return Math.round(n);
}

export function parseOlimpbetOptionalInt(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const INACTIVE_VAR = new Set(['', 'NONE', 'NULL', 'NO', 'FALSE', '0', 'INACTIVE']);

/** Human-readable VAR badge label, or null when VAR is not active. */
export function parseOlimpbetVarLabel(raw: unknown): string | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized || INACTIVE_VAR.has(normalized)) return null;
  if (normalized.includes('VAR') || normalized.includes('REVIEW') || normalized.includes('CHECK')) {
    return 'VAR';
  }
  return 'VAR';
}

export function parseOlimpbetPenaltyRisk(raw: unknown): boolean {
  if (raw == null || raw === false) return false;
  const normalized = String(raw).trim().toUpperCase();
  if (!normalized || INACTIVE_VAR.has(normalized)) return false;
  return true;
}

export type OlimpbetFeedExtras = {
  announcedAddedTime?: number | null;
  varState?: string | null;
  remainingTimeInPeriodSec?: number | null;
  currentTimeInPeriodSec?: number | null;
  overtimeNumber?: number | null;
  penaltyRisk?: boolean | null;
};

export function extractOlimpbetFeedExtras(
  inline: OlimpbetInlineStat[] | null | undefined,
  common?: Record<string, unknown> | null,
  options?: { includeAnnouncedAddedTime?: boolean },
): OlimpbetFeedExtras {
  const extras: OlimpbetFeedExtras = {};

  if (options?.includeAnnouncedAddedTime !== false) {
    const announced = parseAnnouncedAddedMinutes(inline, common);
    if (announced != null) extras.announcedAddedTime = announced;
  }

  const varState = parseOlimpbetVarLabel(common?.currentVarState);
  if (varState) extras.varState = varState;

  const remainingSec = parseOlimpbetDurationSeconds(common?.remainingTimeInPeriod);
  if (remainingSec != null) extras.remainingTimeInPeriodSec = remainingSec;

  const currentInPeriodSec = parseOlimpbetDurationSeconds(common?.currentTimeInPeriod);
  if (currentInPeriodSec != null) extras.currentTimeInPeriodSec = currentInPeriodSec;

  const overtimeNumber = parseOlimpbetOptionalInt(common?.overtimeNumber);
  if (overtimeNumber != null) extras.overtimeNumber = overtimeNumber;

  if (parseOlimpbetPenaltyRisk(common?.penaltyRiskState)) {
    extras.penaltyRisk = true;
  }

  return extras;
}

export function applyOlimpbetFeedExtras<T extends OlimpbetFeedExtras>(
  target: T,
  extras: OlimpbetFeedExtras,
): T {
  if (extras.announcedAddedTime != null) target.announcedAddedTime = extras.announcedAddedTime;
  if (extras.varState) target.varState = extras.varState;
  if (extras.remainingTimeInPeriodSec != null) {
    target.remainingTimeInPeriodSec = extras.remainingTimeInPeriodSec;
  }
  if (extras.currentTimeInPeriodSec != null) {
    target.currentTimeInPeriodSec = extras.currentTimeInPeriodSec;
  }
  if (extras.overtimeNumber != null) target.overtimeNumber = extras.overtimeNumber;
  if (extras.penaltyRisk) target.penaltyRisk = true;
  return target;
}
