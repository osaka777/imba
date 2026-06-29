import type { OlimpbetEventDetail, OlimpbetLinkedEventRef } from '../olimpbet-wc/olimpbet-wc.types';

import type { WcStatListItem } from './wc-odds-statistics.types';

export type LinkedEventStatMapping = {
  id: string;
  name: string;
};

/** Olimpbet linked `eventType.code` → WC stat row. */
export const LINKED_EVENT_STAT_MAP: Record<string, LinkedEventStatMapping> = {
  Corners: { id: 'corners', name: 'Угловые' },
  Yellow_cards: { id: 'yellow_cards', name: 'Жёлтые карточки' },
  Fouls: { id: 'fouls', name: 'Фолы' },
  Shots_on_target: { id: 'shots_on', name: 'Удары в створ' },
  Offsides: { id: 'offsides', name: 'Офсайды' },
  Outs: { id: 'outs', name: 'Ауты' },
  Goal_kicks: { id: 'goal_kicks', name: 'Удары от ворот' },
  Woodwork: { id: 'woodwork', name: 'Штанга/перекладина' },
  Shots: { id: 'shots', name: 'Удары' },
  Saves: { id: 'saves', name: 'Сейвы' },
  Substitutions: { id: 'substitutions', name: 'Замены' },
  Won_aerial_duels: { id: 'aerial_duels', name: 'Верховые единоборства' },
  Expected_goals: { id: 'expected_goals', name: 'xG' },
  Interceptions: { id: 'interceptions', name: 'Перехваты' },
  Successful_dribbles: { id: 'dribbles', name: 'Обводки' },
  Successful_tackles: { id: 'tackles', name: 'Отборы' },
  Aces: { id: 'aces', name: 'Эйсы' },
  Double_faults: { id: 'double_faults', name: 'Двойные ошибки' },
};

function inlineStatValue(
  stats: Array<{ code: string; value: string }> | null | undefined,
  code: string,
): string | null {
  const row = (stats ?? []).find((s) => s.code === code);
  const value = row?.value;
  return value != null && String(value).trim() !== '' ? String(value).trim() : null;
}

function parseScorePair(raw: string | null | undefined): { home: number; away: number } | null {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*[:\-–]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const home = Number(match[1]);
  const away = Number(match[2]);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

export function extractLinkedEventStatRow(
  ref: Pick<OlimpbetLinkedEventRef, 'eventType'>,
  detail: Pick<OlimpbetEventDetail, 'statistics' | 'score'>,
): WcStatListItem | null {
  const code = ref.eventType?.code ?? '';
  const mapping = LINKED_EVENT_STAT_MAP[code];
  if (!mapping) return null;

  const fromInline = parseScorePair(inlineStatValue(detail.statistics, 'score'));
  const fromScoreObject =
    detail.score?.home != null && detail.score?.away != null
      ? { home: Number(detail.score.home), away: Number(detail.score.away) }
      : null;
  const pair = fromInline ?? fromScoreObject;
  if (!pair) return null;

  return {
    id: mapping.id,
    name: mapping.name,
    opp1: String(pair.home),
    opp2: String(pair.away),
  };
}

function statRowWeight(row: WcStatListItem): number {
  const home = Number(row.opp1);
  const away = Number(row.opp2);
  const total = (Number.isFinite(home) ? home : 0) + (Number.isFinite(away) ? away : 0);
  return total;
}

/** Merge linked-event counters; prefer the row with higher total when ids collide. */
export function mergeLinkedStatsIntoList(
  base: WcStatListItem[],
  linkedRows: WcStatListItem[],
): WcStatListItem[] {
  if (linkedRows.length === 0) return base;

  const byId = new Map<string, WcStatListItem>();
  for (const row of base) byId.set(row.id, row);

  for (const row of linkedRows) {
    const prev = byId.get(row.id);
    if (!prev || statRowWeight(row) > statRowWeight(prev)) {
      byId.set(row.id, row);
    }
  }

  const order = [...base.map((r) => r.id)];
  for (const row of linkedRows) {
    if (!order.includes(row.id)) order.push(row.id);
  }

  return order.map((id) => byId.get(id)).filter((row): row is WcStatListItem => Boolean(row));
}

export function collectLinkedStatRows(
  refs: OlimpbetLinkedEventRef[],
  detailsById: Map<number, OlimpbetEventDetail>,
): WcStatListItem[] {
  const rows: WcStatListItem[] = [];
  for (const ref of refs) {
    const detail = detailsById.get(ref.eventId);
    if (!detail) continue;
    const row = extractLinkedEventStatRow(ref, detail);
    if (row) rows.push(row);
  }
  return rows;
}
