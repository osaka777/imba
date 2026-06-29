import type { OlimpbetEventDetail } from './olimpbet-wc.types';

export function extractOlimpbetHeadToHeadId(
  detail: OlimpbetEventDetail | null | undefined,
): string | null {
  for (const item of detail?.integrations ?? []) {
    const id = item?.headToHeadId?.trim();
    if (id) return id;
  }
  return null;
}

export function sportRadarMatchNumericId(headToHeadId: string): string | null {
  const match = headToHeadId.match(/(\d+)\s*$/);
  return match?.[1] ?? null;
}
