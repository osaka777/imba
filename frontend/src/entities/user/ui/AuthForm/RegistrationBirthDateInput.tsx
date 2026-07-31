"use client";

import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import { FiCalendar } from "react-icons/fi";

import {
  birthDateDigitsToIso,
  extractBirthDateDigits,
  formatBirthDateDisplay,
  getBirthDatePickerMax,
  isBirthDateUnderMinAge,
  isoToBirthDateDigits,
  MIN_REGISTRATION_AGE,
} from "~/entities/user/lib/registrationBirthDate";

import { useLocale } from "~/shared/model/useLocale";

import styles from "./RegistrationFields.module.css";

type RegistrationBirthDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
};

export function RegistrationBirthDateInput({
  value,
  onChange,
  onBlur,
  className,
}: RegistrationBirthDateInputProps) {
  const { t } = useLocale();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState(() => isoToBirthDateDigits(value));
  const [focused, setFocused] = useState(false);
  const maxDate = useMemo(() => getBirthDatePickerMax(), []);

  const display = useMemo(() => formatBirthDateDisplay(digits), [digits]);

  const showAgeWarning = useMemo(() => {
    const iso = birthDateDigitsToIso(digits);
    return iso ? isBirthDateUnderMinAge(iso) : false;
  }, [digits]);

  const syncDigits = (nextDigits: string) => {
    setDigits(nextDigits);
    const iso = birthDateDigitsToIso(nextDigits);
    onChange(iso ?? "");
  };

  const handleChange = (raw: string) => {
    syncDigits(extractBirthDateDigits(raw));
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();

    const iso = birthDateDigitsToIso(digits);
    if (iso) {
      setDigits(isoToBirthDateDigits(iso));
      onChange(iso);
    }
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    try {
      if (typeof picker.showPicker === "function") {
        picker.showPicker();
        return;
      }
    } catch {
      // iOS Safari may block showPicker outside direct gesture
    }

    picker.click();
  };

  return (
    <div className={clsx(styles.field, styles.dateField, className)}>
      <div
        className={clsx(
          styles.pill,
          styles.pillDate,
          focused && !showAgeWarning && styles.pillFocused,
          showAgeWarning && styles.pillDateWarning,
        )}
      >
        <input
          autoComplete="bday"
          className={clsx(styles.input, styles.dateTextInput)}
          inputMode="numeric"
          onBlur={handleBlur}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={t("auth.birthPlaceholder")}
          type="text"
          value={display}
        />
        <input
          ref={pickerRef}
          aria-hidden
          className={styles.datePickerHidden}
          max={maxDate}
          min="1900-01-01"
          onChange={(event) => {
            const iso = event.target.value;
            if (!iso) return;
            syncDigits(isoToBirthDateDigits(iso));
          }}
          tabIndex={-1}
          type="date"
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        />
        <button
          aria-label={t("auth.pickDate")}
          className={styles.dateIconButton}
          onClick={openPicker}
          type="button"
        >
          <FiCalendar aria-hidden className={styles.dateIcon} />
        </button>
      </div>
      {showAgeWarning ? (
        <p className={styles.dateHint}>
          {t("auth.ageWarning", { n: MIN_REGISTRATION_AGE })}
        </p>
      ) : null}
    </div>
  );
}
