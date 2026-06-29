"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

import {
  filterRegistrationCountries,
  type RegistrationCountry,
} from "~/entities/user/lib/registrationCountries";

import { RegistrationCountryFlag } from "./RegistrationCountryFlag";
import styles from "./RegistrationCurrencyModal.module.css";

type RegistrationCountryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSelect: (country: RegistrationCountry) => void;
};

export function RegistrationCountryModal({
  open,
  onOpenChange,
  value,
  onSelect,
}: RegistrationCountryModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredCountries = useMemo(
    () => filterRegistrationCountries(query),
    [query],
  );

  const handleSelect = (country: RegistrationCountry) => {
    onSelect(country);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={styles.registrationCurrencyModal_overlay}
          data-registration-submodal=""
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={styles.registrationCurrencyModal_content}
          data-registration-submodal=""
        >
          <div className={styles.registrationCurrencyModal_header}>
            <DialogPrimitive.Title className={styles.registrationCurrencyModal_title}>
              Выбор страны
            </DialogPrimitive.Title>
          </div>

          <div className={styles.registrationCurrencyModal_searchWrap}>
            <FiSearch
              aria-hidden
              className={styles.registrationCurrencyModal_searchIcon}
            />
            <input
              autoFocus
              className={styles.registrationCurrencyModal_searchInput}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
              type="search"
              value={query}
            />
          </div>

          {filteredCountries.length ? (
            <ul className={styles.registrationCurrencyModal_list} role="listbox">
              {filteredCountries.map((country) => (
                <li
                  key={country.code}
                  className={styles.registrationCurrencyModal_item}
                >
                  <button
                    aria-selected={country.code === value}
                    className={clsx(
                      styles.registrationCurrencyModal_option,
                      country.code === value && styles.registrationCurrencyModal_option_active,
                    )}
                    onClick={() => handleSelect(country)}
                    role="option"
                    type="button"
                  >
                    <RegistrationCountryFlag code={country.code} size="lg" />
                    <span className={styles.registrationCurrencyModal_text}>
                      <span className={styles.registrationCurrencyModal_name}>
                        {country.name}
                      </span>
                      <span className={styles.registrationCurrencyModal_code}>
                        {country.dialCode}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.registrationCurrencyModal_empty}>
              Ничего не найдено
            </p>
          )}

          <DialogPrimitive.Close
            aria-label="Закрыть"
            className={styles.registrationCurrencyModal_close}
          >
            <FiX aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
