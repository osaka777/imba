import type { WcEvent } from "~/entities/wc-odds/api/client";

export type WcListStatCol = {
  id: string;
  label: string;
  home: string;
  away: string;
};

type WcEventWithStats = Pick<
  WcEvent,
  "sport" | "statList" | "phase" | "hasLiveTracker"
>;

function pickStat(event: WcEventWithStats, id: string) {
  return event.statList?.find((row) => row.id === id);
}

function statPair(row: { opp1: string; opp2: string } | undefined): [string, string] | null {
  if (!row) return null;
  return [row.opp1, row.opp2];
}

function hasActivity(home: string, away: string): boolean {
  return Number(home) > 0 || Number(away) > 0;
}

/** Compact stat columns for live list rows (home / live line). */
export function buildWcListStatCols(event: WcEventWithStats): WcListStatCol[] {
  if (event.phase !== "live") return [];

  const cols: WcListStatCol[] = [];
  const add = (id: string, label: string, requireActivity = false) => {
    const pair = statPair(pickStat(event, id));
    if (!pair) return;
    if (requireActivity && !hasActivity(pair[0], pair[1])) return;
    cols.push({ id, label, home: pair[0], away: pair[1] });
  };

  if (event.sport === "soccer") {
    add("yellow_cards", "ЖК");
    add("red_cards", "КК", true);
    add("yellow_red_cards", "Ж/К", true);
    add("corners", "УГ");
    add("fouls", "Ф");
  }

  if (event.sport === "basketball") {
    add("fouls", "Ф");
  }

  if (event.sport === "hockey") {
    add("penalty_minutes", "Ш");
    add("shots_on", "Б");
  }

  if (event.sport === "volleyball" || event.sport === "tennis" || event.sport === "table-tennis") {
    add("aces", "Э");
    if (event.sport === "tennis" || event.sport === "table-tennis") {
      add("double_faults", "О");
    }
  }

  return cols;
}

export function wcEventHasListStats(event: WcEventWithStats): boolean {
  return buildWcListStatCols(event).length > 0;
}

/** Stats icon on home/live list: enriched stat rows OR live tracker. */
export function wcEventHasGameStats(event: WcEventWithStats): boolean {
  if (event.phase !== "live") return false;
  if (event.hasLiveTracker) return true;
  const list = event.statList;
  if (!list?.length) return false;

  if (buildWcListStatCols(event).length > 0) return true;

  if (list.length >= 2) return true;

  const lone = list[0];
  if (
    lone
    && lone.id === "red_cards"
    && lone.opp1 === "0"
    && lone.opp2 === "0"
  ) {
    return false;
  }

  return true;
}
