"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import { useLocale } from "~/shared/model/useLocale";
import { FiChevronDown } from "react-icons/fi";

import {
  REGISTRATION_CURRENCY_CODES,
  REGISTRATION_CURRENCY_SHORT_LABELS,
} from "~/entities/user/lib/registrationCountries";

import { RegistrationCurrencyIcon } from "./RegistrationCurrencyIcon";
import { RegistrationCurrencyModal } from "./RegistrationCurrencyModal";
import styles from "./RegistrationFields.module.css";

type CurrencyOption = {
  isoCode: string;
  name: string;
};

type RegistrationCurrencySelectProps = {
  currencies: CurrencyOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
};

export function RegistrationCurrencySelect({
  currencies,
  value,
  onChange,
  onBlur,
  className,
}: RegistrationCurrencySelectProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const allowed = new Set<string>(REGISTRATION_CURRENCY_CODES);
    return currencies
      .filter((item) => allowed.has(item.isoCode))
      .sort(
        (a, b) =>
          REGISTRATION_CURRENCY_CODES.indexOf(a.isoCode as typeof REGISTRATION_CURRENCY_CODES[number])
          - REGISTRATION_CURRENCY_CODES.indexOf(b.isoCode as typeof REGISTRATION_CURRENCY_CODES[number]),
      );
  }, [currencies]);

  const selected =
    options.find((item) => item.isoCode === value) ??
    (value
      ? { isoCode: value, name: REGISTRATION_CURRENCY_SHORT_LABELS[value] ?? value }
      : options[0]);
  const label = selected
    ? REGISTRATION_CURRENCY_SHORT_LABELS[selected.isoCode] ?? selected.name
    : t("common.selectCurrencyHint");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      onBlur?.();
    }
  };

  return (
    <>
      <div className={clsx(styles.field, className)}>
        <button
          aria-haspopup="dialog"
          className={clsx(styles.pill, styles.pillSelect, open && styles.pillOpen)}
          onClick={() => setOpen(true)}
          type="button"
        >
          {selected ? <RegistrationCurrencyIcon isoCode={selected.isoCode} /> : null}
          <span className={styles.divider} />
          <span className={styles.currencyLabel}>{label}</span>
          <FiChevronDown className={clsx(styles.chevron, open && styles.chevronOpen)} />
        </button>
      </div>

      <RegistrationCurrencyModal
        onOpenChange={handleOpenChange}
        onSelect={onChange}
        open={open}
        options={options}
        value={value}
      />
    </>
  );
}
