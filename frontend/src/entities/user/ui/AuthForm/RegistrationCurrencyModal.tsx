"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

import {
  filterRegistrationCurrencies,
  getCurrencyIconUrl,
  getRegistrationCurrencyListName,
} from "~/entities/user/lib/registrationCountries";

import styles from "./RegistrationCurrencyModal.module.css";

type CurrencyOption = {
  isoCode: string;
  name: string;
};

type RegistrationCurrencyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: CurrencyOption[];
  value: string;
  onSelect: (isoCode: string) => void;
};

export function RegistrationCurrencyModal({
  open,
  onOpenChange,
  options,
  value,
  onSelect,
}: RegistrationCurrencyModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredOptions = useMemo(
    () => filterRegistrationCurrencies(options, query),
    [options, query],
  );

  const handleSelect = (isoCode: string) => {
    onSelect(isoCode);
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
              Выбор валюты
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

          {filteredOptions.length ? (
            <ul className={styles.registrationCurrencyModal_list} role="listbox">
              {filteredOptions.map((item) => (
                <li
                  key={item.isoCode}
                  className={styles.registrationCurrencyModal_item}
                >
                  <button
                    aria-selected={item.isoCode === value}
                    className={clsx(
                      styles.registrationCurrencyModal_option,
                      item.isoCode === value && styles.registrationCurrencyModal_option_active,
                    )}
                    onClick={() => handleSelect(item.isoCode)}
                    role="option"
                    type="button"
                  >
                    <span className={styles.registrationCurrencyModal_iconWrap}>
                      <img
                        alt=""
                        className={styles.registrationCurrencyModal_icon}
                        decoding="async"
                        draggable={false}
                        loading="lazy"
                        src={getCurrencyIconUrl(item.isoCode)}
                      />
                    </span>
                    <span className={styles.registrationCurrencyModal_text}>
                      <span className={styles.registrationCurrencyModal_name}>
                        {getRegistrationCurrencyListName(item.isoCode, item.name)}
                      </span>
                      <span className={styles.registrationCurrencyModal_code}>
                        {item.isoCode}
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
