"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next-nprogress-bar";
import { useLocalStorage } from "usehooks-ts";

import {
  MastercardLogoIcon,
  NirvanaPayIcon,
  VisaLogoIcon,
} from "~/shared/assets";


import styles from "./DepositForm.module.css";
import { SystemSelect } from "./SystemSelect";
import { forms } from "./forms";
import { AaioForm } from "./forms/AaioForm";
import { NirvanaPayForm } from "./forms/NirvanaPayForm";
import { ForeignKztCardForm } from "./forms/ForeignKztCardForm";
import { ForeignKztInitForm } from "./forms/ForeignKztInitForm";
import { ForeignRubInitForm } from "./forms/ForeignRubInitForm";

interface DepositFormProps {
  forceCurrency?: string;
}

export const DepositForm: React.FC<DepositFormProps> = ({ forceCurrency }) => {

  const [formCurrency, setFormCurrency] = useState<string>("USD");
  const [storedCurrency, setStoredCurrency] = useLocalStorage<string>("currency", "USD");
  const [showTooltip, setShowTooltip] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (forceCurrency) {
      setFormCurrency(forceCurrency);
    } else {
      setFormCurrency(storedCurrency);
    }
  }, [forceCurrency, storedCurrency]);


  const [paymentSystem, setPaymentSystem] = useState<null | string>(null);

  useEffect(() => {
    if (formCurrency === "KZT") {
      setPaymentSystem("ForeignKztCardForm");
    } else if (formCurrency === "RUB") {
      setPaymentSystem("ForeignRubCardForm");
    } else if (["USD", "UAH"].includes(formCurrency)) {
      setPaymentSystem("AaioForm");
    } else {
      setPaymentSystem(null);
    }
  }, [formCurrency]);

  const inCurrency = (list: string[]) => {
    return list.some((item) => item === formCurrency);
  };

  const currentLogos = useMemo(() => {
    switch (formCurrency) {
      case "KZT":
      case "TRY":
      case "UZS":
        return [NirvanaPayIcon];
      default:
        return [MastercardLogoIcon, VisaLogoIcon];
    }
  }, [formCurrency]);

  return (
    <div className={styles.DepositForm}>
      <div aria-hidden className={styles.mobileHeaderSpacer} />
      <div className={styles.systemSelectSection}>
        {inCurrency(["KZT", "UZS"]) ? (
          <>
          {formCurrency === 'KZT' && (
              <SystemSelect
                formName="ForeignKztCardForm"
                icons={[MastercardLogoIcon, VisaLogoIcon]}
                paymentSystem={paymentSystem}
                setPaymentSystem={setPaymentSystem}
                text="Visa/Mastercard"
              />
            )}
            <SystemSelect
              formName="NirvanaPayForm"
              icons={currentLogos}
              paymentSystem={paymentSystem}
              setPaymentSystem={setPaymentSystem}
              text="NirvanaPay"
            />
          </>
        ) : inCurrency(["RUB"]) ? (
          <>
            <SystemSelect
              formName="ForeignRubCardForm"
              icons={[MastercardLogoIcon, VisaLogoIcon]}
              paymentSystem={paymentSystem}
              setPaymentSystem={setPaymentSystem}
              text="Visa/Mastercard"
            />
            <SystemSelect
              formName="AaioForm"
              icons={currentLogos}
              paymentSystem={paymentSystem}
              setPaymentSystem={setPaymentSystem}
              text="Карты"
            />
          </>
        ) : inCurrency(["USD", "UAH"]) && (
          <>
            <SystemSelect
              formName="AaioForm"
              icons={currentLogos}
              paymentSystem={paymentSystem}
              setPaymentSystem={setPaymentSystem}
              text="Карты"
            />
          </>
        )}
        {/* <div className={styles.telegramPromoBlock}>
          <div className={styles.telegramPromoTitle}>
            💸 Проблемы с пополнением?
          </div>
          <div className={styles.telegramPromoDescription}>
            Пополняйте через наш Telegram-бот<br />
            и получайте +5% бонус к балансу!
          </div>
          <a 
            href="https://t.me/thelattafa" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.telegramPromoButton}
          >
            📱 Перейти в Telegram
          </a>
          <div className={styles.telegramPromoBonus}>
            Быстро, удобно и с бонусом 🎁
          </div>
        </div> */}
      </div>
      
      
      
      <div className={styles.formSection}>
        {paymentSystem ? (
          <>
            {paymentSystem === "NirvanaPayForm" && (
              <NirvanaPayForm forceCurrency={forceCurrency} />
            )}
            {paymentSystem === "ForeignKztCardForm" && (
              <ForeignKztInitForm forceCurrency={forceCurrency} />
            )}
            {paymentSystem === "ForeignRubCardForm" && (
              <ForeignRubInitForm forceCurrency={forceCurrency} />
            )}
            {paymentSystem === "AaioForm" && (
              <AaioForm forceCurrency={forceCurrency} isImbaMethod={false} />
            )}
          </>
        ) : (
          <div className={styles.formSection_empty}>
            Выберите способ оплаты
          </div>
        )}
      </div>
    </div>
  );
};