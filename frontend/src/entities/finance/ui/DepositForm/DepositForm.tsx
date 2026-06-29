"use client";

import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import {
  MastercardLogoIcon,
  VisaLogoIcon,
} from "~/shared/assets";

import kaspiLogo from "~/shared/assets/images/kaspi-logo.png";

import {
  getPublicPaymentSettings,
  isManualMethodEnabled,
  type PublicPaymentSettings,
} from "~/entities/finance/api/paymentSettings";

import styles from "./DepositForm.module.css";
import { SystemSelect } from "./SystemSelect";
import { ForeignKztInitForm } from "./forms/ForeignKztInitForm";
import { ForeignRubInitForm } from "./forms/ForeignRubInitForm";
import { UsdtTrc20InitForm } from "./forms/UsdtTrc20InitForm";
import { AaioForm } from "./forms/AaioForm";

interface DepositFormProps {
  forceCurrency?: string;
  defaultAmount?: number;
  presetAmounts?: number[];
  initialVoucher?: string;
  depositSource?: string;
  compact?: boolean;
  /** Render inside promo modal (no DialogClose wrapper). */
  embedded?: boolean;
  /** Tighter layout for WC promo modal on mobile. */
  modalEmbedded?: boolean;
  onDepositComplete?: () => void;
}

export const DepositForm: React.FC<DepositFormProps> = ({
  forceCurrency,
  defaultAmount,
  presetAmounts,
  initialVoucher,
  depositSource = 'deposit-modal',
  compact = false,
  embedded = false,
  modalEmbedded = false,
  onDepositComplete,
}) => {
  const [paymentStepActive, setPaymentStepActive] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings | null>(null);

  const [formCurrency, setFormCurrency] = useState<string>("USD");
  const [storedCurrency] = useLocalStorage<string>("currency", "USD");

  const [paymentSystem, setPaymentSystem] = useState<null | string>(null);

  useEffect(() => {
    getPublicPaymentSettings().then(setPaymentSettings);
  }, []);

  useEffect(() => {
    if (forceCurrency) {
      setFormCurrency(forceCurrency);
    } else {
      setFormCurrency(storedCurrency);
    }
  }, [forceCurrency, storedCurrency]);

  const kaspiEnabled = isManualMethodEnabled(paymentSettings, "KZT_KASPI");
  const kztCardEnabled = isManualMethodEnabled(paymentSettings, "KZT");
  const rubRfEnabled = isManualMethodEnabled(paymentSettings, "RUB_SBERBANK");
  const usdtEnabled =
    isManualMethodEnabled(paymentSettings, "USDT") &&
    paymentSettings?.paymentMethods.USDT_TRC20?.enabled !== false;
  const aaioEnabled = paymentSettings?.paymentMethods.Aaio?.enabled !== false;

  useEffect(() => {
    if (formCurrency === "KZT") {
      if (kaspiEnabled) setPaymentSystem("ForeignKztKaspiForm");
      else if (kztCardEnabled) setPaymentSystem("ForeignKztCardForm");
      else setPaymentSystem(null);
    } else if (formCurrency === "RUB") {
      if (rubRfEnabled) setPaymentSystem("ForeignRubSberbankForm");
      else setPaymentSystem(null);
    } else if (formCurrency === "USDT") {
      if (usdtEnabled) setPaymentSystem("UsdtTrc20Form");
      else setPaymentSystem(null);
    } else if (["USD", "UAH"].includes(formCurrency)) {
      if (aaioEnabled) setPaymentSystem("AaioForm");
      else setPaymentSystem(null);
    } else {
      setPaymentSystem(null);
    }
  }, [formCurrency, kaspiEnabled, kztCardEnabled, rubRfEnabled, usdtEnabled, aaioEnabled]);

  useEffect(() => {
    if (paymentSystem === "ForeignKztKaspiForm" && !kaspiEnabled) {
      setPaymentSystem(kztCardEnabled ? "ForeignKztCardForm" : null);
    }
    if (paymentSystem === "ForeignKztCardForm" && !kztCardEnabled) {
      setPaymentSystem(kaspiEnabled ? "ForeignKztKaspiForm" : null);
    }
    if (paymentSystem === "ForeignRubSberbankForm" && !rubRfEnabled) {
      setPaymentSystem(null);
    }
    if (paymentSystem === "UsdtTrc20Form" && !usdtEnabled) {
      setPaymentSystem(null);
    }
  }, [paymentSystem, kaspiEnabled, kztCardEnabled, rubRfEnabled, usdtEnabled]);

  const inCurrency = (list: string[]) => list.some((item) => item === formCurrency);

  const showKztMethods = formCurrency === "KZT" && (kaspiEnabled || kztCardEnabled);
  const showRubMethod = inCurrency(["RUB"]) && rubRfEnabled;
  const showUsdtMethod = inCurrency(["USDT"]) && usdtEnabled;
  const showAaio = inCurrency(["USD", "UAH"]) && aaioEnabled;

  const enabledMethodCount =
    (showKztMethods && kaspiEnabled ? 1 : 0) +
    (showKztMethods && kztCardEnabled ? 1 : 0) +
    (showRubMethod ? 1 : 0) +
    (showUsdtMethod ? 1 : 0) +
    (showAaio ? 1 : 0);

  const hideMethodPicker = modalEmbedded && enabledMethodCount <= 1;
  const usdtPaymentStepActive =
    paymentStepActive && paymentSystem === "UsdtTrc20Form";

  return (
    <div
      className={`${styles.DepositForm}${paymentStepActive ? ` ${styles.paymentStepActive}` : ""}${usdtPaymentStepActive ? ` ${styles.usdtPaymentStepActive}` : ""}${compact ? ` ${styles.compact}` : ""}${embedded ? ` ${styles.embedded}` : ""}${modalEmbedded ? ` ${styles.modalEmbedded}` : ""}`}
      data-payment-step={paymentStepActive ? "active" : undefined}
      data-usdt-payment-step={usdtPaymentStepActive ? "active" : undefined}
    >
      <div aria-hidden className={styles.mobileHeaderSpacer} />
      {!hideMethodPicker ? (
      <div className={styles.systemSelectSection}>
        {showKztMethods ? (
          <>
            {kaspiEnabled ? (
              <SystemSelect
                formName="ForeignKztKaspiForm"
                icons={[kaspiLogo]}
                paymentSystem={paymentSystem}
                setPaymentSystem={setPaymentSystem}
                text="Kaspi"
                variant="kaspi"
              />
            ) : null}
            {kztCardEnabled ? (
              <SystemSelect
                formName="ForeignKztCardForm"
                icons={[MastercardLogoIcon, VisaLogoIcon]}
                paymentSystem={paymentSystem}
                setPaymentSystem={setPaymentSystem}
                text="Visa/Mastercard"
              />
            ) : null}
          </>
        ) : null}
        {showRubMethod ? (
          <SystemSelect
            formName="ForeignRubSberbankForm"
            icons={["/sberbank.png"]}
            paymentSystem={paymentSystem}
            setPaymentSystem={setPaymentSystem}
            text="Перевод из РФ"
            variant="sberbank"
          />
        ) : null}
        {showUsdtMethod ? (
          <SystemSelect
            formName="UsdtTrc20Form"
            icons={["/currency/usd.svg"]}
            paymentSystem={paymentSystem}
            setPaymentSystem={setPaymentSystem}
            text="USDT TRC-20"
          />
        ) : null}
        {showAaio ? (
          <SystemSelect
            formName="AaioForm"
            icons={[MastercardLogoIcon, VisaLogoIcon]}
            paymentSystem={paymentSystem}
            setPaymentSystem={setPaymentSystem}
            text="Карты"
          />
        ) : null}
      </div>
      ) : null}

      <div className={styles.formSection}>
        {paymentSystem ? (
          <>
            {paymentSystem === "ForeignKztKaspiForm" && kaspiEnabled ? (
              <ForeignKztInitForm
                forceCurrency={forceCurrency}
                defaultAmount={defaultAmount}
                presetAmounts={presetAmounts}
                initialVoucher={initialVoucher}
                depositSource={depositSource}
                embedded={embedded}
                modalEmbedded={modalEmbedded}
                onDepositComplete={onDepositComplete}
                onPaymentStepChange={setPaymentStepActive}
                variant="kaspi"
              />
            ) : null}
            {paymentSystem === "ForeignKztCardForm" && kztCardEnabled ? (
              <ForeignKztInitForm
                forceCurrency={forceCurrency}
                defaultAmount={defaultAmount}
                presetAmounts={presetAmounts}
                initialVoucher={initialVoucher}
                depositSource={depositSource}
                embedded={embedded}
                modalEmbedded={modalEmbedded}
                onDepositComplete={onDepositComplete}
                onPaymentStepChange={setPaymentStepActive}
                variant="card"
              />
            ) : null}
            {paymentSystem === "ForeignRubSberbankForm" && rubRfEnabled ? (
              <ForeignRubInitForm
                forceCurrency={forceCurrency}
                defaultAmount={defaultAmount}
                presetAmounts={presetAmounts}
                initialVoucher={initialVoucher}
                depositSource={depositSource}
                embedded={embedded}
                modalEmbedded={modalEmbedded}
                onDepositComplete={onDepositComplete}
                onPaymentStepChange={setPaymentStepActive}
                variant="sberbank"
              />
            ) : null}
            {paymentSystem === "AaioForm" && aaioEnabled ? (
              <AaioForm forceCurrency={forceCurrency} isImbaMethod={false} />
            ) : null}
            {paymentSystem === "UsdtTrc20Form" && usdtEnabled ? (
              <UsdtTrc20InitForm
                forceCurrency={forceCurrency}
                embedded={embedded}
                depositSource={depositSource}
                onDepositComplete={onDepositComplete}
                onPaymentStepChange={setPaymentStepActive}
              />
            ) : null}
          </>
        ) : (
          <div className={styles.formSection_empty}>
            {formCurrency === "KZT" && !kaspiEnabled && !kztCardEnabled
              ? "Способы пополнения для KZT временно недоступны"
              : formCurrency === "RUB" && !rubRfEnabled
                ? "Способ пополнения для RUB временно недоступен"
                : formCurrency === "USDT" && !usdtEnabled
                  ? "Способ пополнения USDT временно недоступен"
                : "Выберите способ оплаты"}
          </div>
        )}
      </div>
    </div>
  );
};
