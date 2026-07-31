/** Minimum age to register and use Imba.bet betting services. */
export const MIN_REGISTRATION_AGE = 21;

export function extractBirthDateDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function isoToBirthDateDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function isoToBirthDateDigits(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}${month}${year}`;
}

export function birthDateDigitsToIso(digits: string): string | null {
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function formatBirthDateDisplay(digits: string): string {
  const normalized = digits.slice(0, 8);
  if (!normalized.length) return "";
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 4) {
    return `${normalized.slice(0, 2)}.${normalized.slice(2)}`;
  }
  return `${normalized.slice(0, 2)}.${normalized.slice(2, 4)}.${normalized.slice(4)}`;
}

export function getBirthDatePickerMax(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MIN_REGISTRATION_AGE);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isBirthDateUnderMinAge(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso > getBirthDatePickerMax();
}

/** @deprecated Use isBirthDateUnderMinAge */
export function isBirthDateUnder18(iso: string): boolean {
  return isBirthDateUnderMinAge(iso);
}
