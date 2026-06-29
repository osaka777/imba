export function calculateBrlFromRub(rubAmount: number, rubPerBrl: number): number {
  if (!Number.isFinite(rubAmount) || rubAmount <= 0) return 0;
  if (!Number.isFinite(rubPerBrl) || rubPerBrl <= 0) return Math.ceil(rubAmount);
  return Math.ceil(rubAmount / rubPerBrl);
}
