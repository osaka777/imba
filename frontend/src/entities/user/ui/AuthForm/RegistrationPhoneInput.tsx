"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

import {
  buildInternationalPhone,
  DEFAULT_REGISTRATION_COUNTRY,
  formatLocalPhoneDisplay,
  formatPhoneDigits,
  REGISTRATION_COUNTRIES,
  type RegistrationCountry,
} from "~/entities/user/lib/registrationCountries";

import { RegistrationCountryFlag } from "./RegistrationCountryFlag";
import { RegistrationCountryModal } from "./RegistrationCountryModal";
import styles from "./RegistrationFields.module.css";

type RegistrationPhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
};

export function RegistrationPhoneInput({
  value,
  onChange,
  onBlur,
  className,
}: RegistrationPhoneInputProps) {
  const initialCountry = useMemo(() => {
    const matched = REGISTRATION_COUNTRIES.find((country) => value.startsWith(country.dialCode));
    return matched ?? DEFAULT_REGISTRATION_COUNTRY;
  }, [value]);

  const [country, setCountry] = useState<RegistrationCountry>(initialCountry);
  const [localDigits, setLocalDigits] = useState(() => {
    if (!value) return "";
    return formatPhoneDigits(value.slice(country.dialCode.replace(/\D/g, "").length + 1));
  });
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const displayPhone = formatLocalPhoneDisplay(country.code, localDigits);

  const updatePhone = (nextCountry: RegistrationCountry, nextLocalDigits: string) => {
    const normalizedDigits = formatPhoneDigits(nextLocalDigits);
    setCountry(nextCountry);
    setLocalDigits(normalizedDigits);
    onChange(buildInternationalPhone(nextCountry.dialCode, normalizedDigits));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      onBlur?.();
    }
  };

  return (
    <>
      <div className={clsx(styles.field, className)}>
        <div
          className={clsx(
            styles.pill,
            styles.pillPhone,
            (focused || open) && styles.pillFocused,
          )}
        >
          <button
            aria-haspopup="dialog"
            aria-label={`Страна: ${country.name}`}
            className={styles.countryButton}
            onClick={() => setOpen(true)}
            type="button"
          >
            <RegistrationCountryFlag code={country.code} />
            <FiChevronDown className={clsx(styles.chevron, open && styles.chevronOpen)} />
          </button>
          <span className={styles.divider} />
          <div className={styles.phoneValueWrap}>
            <span className={styles.dialCode}>{country.dialCode}</span>
            <input
              autoComplete="tel-national"
              className={styles.phoneInput}
              inputMode="numeric"
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              onChange={(event) => updatePhone(country, event.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={country.placeholder}
              type="tel"
              value={displayPhone}
            />
          </div>
        </div>
      </div>

      <RegistrationCountryModal
        onOpenChange={handleOpenChange}
        onSelect={(nextCountry) => updatePhone(nextCountry, localDigits)}
        open={open}
        value={country.code}
      />
    </>
  );
}
