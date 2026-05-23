export type CardBrand = "mastercard" | "mir" | "unknown" | "visa";

const MASTERCARD_PREFIX =
  /^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[0-1]\d|2720)/;

export const stripCardNumber = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");

export const formatCardNumber = (value: unknown) => {
  const digits = stripCardNumber(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

export const detectCardBrand = (value: unknown): CardBrand => {
  const digits = stripCardNumber(value);
  if (!digits) return "unknown";
  if (/^4/.test(digits)) return "visa";
  if (/^220[0-4]/.test(digits)) return "mir";
  if (MASTERCARD_PREFIX.test(digits)) return "mastercard";
  return "unknown";
};
