/** RUB per 1 BRL (e.g. 183 means 1 R$ = 183 ₽). BRL is rounded up to whole reais. */
export function calculateBrlFromRub(rubAmount: number, rubPerBrl: number): number {
  if (!Number.isFinite(rubAmount) || rubAmount <= 0) return 0;
  if (!Number.isFinite(rubPerBrl) || rubPerBrl <= 0) return Math.ceil(rubAmount);
  return Math.ceil(rubAmount / rubPerBrl);
}

export function formatBrlAmount(brl: number): string {
  return `R$ ${brl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
