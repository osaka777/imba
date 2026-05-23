export const convertToFixed = (coef: string | number | undefined): string => {
  // If coef is missing or already a placeholder, always return "--"
  if (!coef || coef === "--") {
    return "--";
  }
  
  // Convert to string to handle both string and number inputs
  const coefStr = String(coef);
  
  // If there is no decimal point, return as-is
  if (!coefStr.includes(".")) {
    return coefStr;
  }
  const match = coefStr.match(/(?<first>\d*)\.(?<second>\d*)/);
  if (!match || !match.groups) return coefStr;
  const { first, second } = match.groups;
  const secondCoef = second.length > 1 ? second.slice(0, 2) : second[0] || "";
  return `${first}.${secondCoef}`;
};
