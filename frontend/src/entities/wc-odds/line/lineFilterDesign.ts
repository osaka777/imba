/** Дизайн фильтра линии на ПК. Чтобы вернуть старый вид — поставь `"legacy"`. */
export type LineFilterPcDesign = "segmented" | "legacy";

export const LINE_FILTER_PC_DESIGN: LineFilterPcDesign = "legacy";

export function isSegmentedLineFilterDesign(): boolean {
  return LINE_FILTER_PC_DESIGN === "segmented";
}
