export type HistoryStatusFilter =
  | "all"
  | "pending"
  | "cashout"
  | "win"
  | "lose"
  | "return";

export type NormalizedHistoryStatus =
  | "PENDING"
  | "WIN"
  | "LOSE"
  | "RETURN"
  | "CASHOUT";

export function normalizeBetHistoryStatus(
  bet: Record<string, unknown>,
): NormalizedHistoryStatus {
  const status = String(bet.status ?? "");
  if (status === "VOID") return "RETURN";
  if (status === "CASHED_OUT" || status === "CASHOUT") return "CASHOUT";
  if (
    status === "PENDING"
    || status === "WIN"
    || status === "LOSE"
    || status === "RETURN"
  ) {
    return status;
  }
  return "PENDING";
}

export function matchesHistoryStatusFilter(
  bet: Record<string, unknown>,
  filter: HistoryStatusFilter,
): boolean {
  if (filter === "all") return true;
  const status = normalizeBetHistoryStatus(bet);
  switch (filter) {
    case "pending":
      return status === "PENDING";
    case "cashout":
      return status === "CASHOUT";
    case "win":
      return status === "WIN";
    case "lose":
      return status === "LOSE";
    case "return":
      return status === "RETURN";
    default:
      return true;
  }
}

export const HISTORY_STATUS_FILTERS: { id: HistoryStatusFilter }[] = [
  { id: "all" },
  { id: "pending" },
  { id: "cashout" },
  { id: "win" },
  { id: "lose" },
  { id: "return" },
];
