export type WcOddsFlashDirection = "up" | "down";

export type WcOddsFlashStyles = {
  oddFlash_up: string;
  oddFlash_down: string;
  oddCoefficient_up: string;
  oddCoefficient_down: string;
};

/** Bettor view: higher odds → up (green), lower → down (red). */
export function getOddsFlashDirection(
  value: string | number,
  prevState: string | number | undefined,
): WcOddsFlashDirection | null {
  if (value === "--" || typeof prevState === "undefined") return null;

  const next = Number(value);
  const prev = Number(prevState);
  if (!Number.isFinite(next) || !Number.isFinite(prev) || next === prev) return null;

  return next > prev ? "up" : "down";
}

export function wcOddsFlashClasses(
  value: string | number,
  prevState: string | number | undefined,
  styles: WcOddsFlashStyles,
): { cell?: string; coef?: string } {
  const dir = getOddsFlashDirection(value, prevState);
  if (!dir) return {};

  if (dir === "up") {
    return { cell: styles.oddFlash_up, coef: styles.oddCoefficient_up };
  }
  return { cell: styles.oddFlash_down, coef: styles.oddCoefficient_down };
}

/** @deprecated use wcOddsFlashClasses */
export function wcCoefFlashClass(
  value: string | number,
  prevState: string | number | undefined,
  styles: { oddCoefficient_up: string; oddCoefficient_down: string },
): string {
  return wcOddsFlashClasses(value, prevState, {
    oddFlash_up: "",
    oddFlash_down: "",
    oddCoefficient_up: styles.oddCoefficient_up,
    oddCoefficient_down: styles.oddCoefficient_down,
  }).coef ?? "";
}

/** @deprecated use wcOddsFlashClasses */
export function wcCoefFlashCellClasses(
  value: string | number,
  prevState: string | number | undefined,
  styles: WcOddsFlashStyles & { oddCell_up?: string; oddCell_down?: string },
): { cell?: string; coef?: string } {
  const flash = wcOddsFlashClasses(value, prevState, styles);
  if (!flash.cell && !flash.coef) return {};

  return {
    cell: flash.cell ?? (flash.coef?.includes("up") ? styles.oddCell_up : styles.oddCell_down),
    coef: flash.coef,
  };
}
