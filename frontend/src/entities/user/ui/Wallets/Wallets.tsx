"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import styles from "./Wallets.module.css";
import { DepositForm } from "~/entities/finance/ui/DepositForm";
import { DialogContent } from "~/shared/ui/Dialog";
import { Withdraw } from "../Profile/Withdraw";
import { Dialog } from "~/shared/ui/Dialog";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import { KztImage, RubImage, UahImage, TryImage, UzsImage } from "~/shared/assets/images";
import { getCurrencyIconUrl } from "~/entities/user/lib/registrationCountries";
import { ALL_SITE_CURRENCY_CODES } from "~/shared/lib/siteCurrencies";

const getCurrencyIcon = (currencyCode: string) => {
  switch (currencyCode) {
    case 'RUB': return RubImage;
    case 'KZT': return KztImage;
    case 'UAH': return UahImage;
    case 'TRY': return TryImage;
    case 'UZS': return UzsImage;
    default: return null;
  }
};

const currencySymbols: Record<string, string> = {
  KZT: '₸',
  UAH: '₴',
  RUB: '₽',
  TRY: '₺',
  UZS: "so'm",
  USDT: 'USDT',
};

const getCurrencySymbol = (code: string) => currencySymbols[code] || code;

export const Wallets = ({
  wallets,
  balance,
  currency,
  onChangeCurrency
}: {
  wallets: { currencyCode: string; currencyName: string; amount: string }[];
  balance: string;
  currency: string;
  onChangeCurrency: (currency: string) => void;
}) => {
  const [modalWallet, setModalWallet] = useState<null | typeof wallets[0]>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositCurrency, setDepositCurrency] = useState<string | undefined>();
  const { armGuard, blockIfArmed } = useDialogOutsideGuard();

  const openDepositModal = useCallback((currencyCode?: string) => {
    armGuard();
    setDepositCurrency(currencyCode);
    scheduleDialogOpen(setDepositOpen);
  }, [armGuard]);

  return (
    <div className={styles.walletsPage}>
      <header className={styles.pageTitleWrapper}>
        <div className={styles.pageTitle}>Управление счетами</div>
      </header>
      <section className={styles.section}>
        <div className={`${styles.mainBlock} ${styles.lightBlackBlueGradient}`}>
          <div>
            <div className={styles.mainTitle}>Основной счет</div>
            <div className={styles.mainValue}>
              <span suppressHydrationWarning>
                {balance} <span suppressHydrationWarning>{getCurrencySymbol(currency)}</span>
              </span>
            </div>
          </div>
          <div className={styles.mainActions}>
            <Withdraw />
            <button
              type="button"
              className={styles.depositBtn}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openDepositModal();
              }}
            >
              Пополнить
            </button>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <ul className={styles.walletList}>
          {wallets
            .filter(wallet => ALL_SITE_CURRENCY_CODES.includes(wallet.currencyCode as typeof ALL_SITE_CURRENCY_CODES[number]))
            .map((wallet) => (
              <li key={wallet.currencyCode} className={`${styles.walletItem} ${styles.lightBlackBlueGradient}`}>
                <div className={styles.walletInfo}>
                  <div className={styles.currencyIcon}>
                    {getCurrencyIcon(wallet.currencyCode) ? (
                      <Image
                        src={getCurrencyIcon(wallet.currencyCode)!}
                        alt={wallet.currencyCode}
                        width={32}
                        height={32}
                      />
                    ) : (
                      <img
                        src={getCurrencyIconUrl(wallet.currencyCode)}
                        alt={wallet.currencyCode}
                        width={32}
                        height={32}
                      />
                    )}
                  </div>
                  <div>
                    <div className={styles.walletName}>{wallet.currencyName}</div>
                    <div className={styles.walletValue}>
                      <span suppressHydrationWarning>
                        {wallet.amount}
                      </span> <span suppressHydrationWarning>{getCurrencySymbol(wallet.currencyCode)}</span>
                    </div>
                  </div>
                </div>
                <button
                  className={styles.walletDots}
                  onClick={() => setModalWallet(wallet)}
                  aria-label="Открыть действия"
                >
                  <span className={styles.dotsIcon}>
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </section>

      {modalWallet && (
        <div className={styles.modalOverlay} onClick={() => setModalWallet(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderInfo}>
                {getCurrencyIcon(modalWallet.currencyCode) && (
                  <div className={styles.modalCurrencyIcon}>
                    <Image 
                      src={getCurrencyIcon(modalWallet.currencyCode)!} 
                      alt={modalWallet.currencyCode} 
                      width={40} 
                      height={40} 
                    />
                  </div>
                )}
                <div>
                  <div className={styles.modalTitle}>{modalWallet.currencyName}</div>
                  <div className={styles.modalBalance}>
                    <span suppressHydrationWarning>
                      {modalWallet.amount} {getCurrencySymbol(modalWallet.currencyCode)}
                    </span>
                  </div>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setModalWallet(null)}>×</button>
            </div>
            <div className={styles.modalActions}>
              {currency !== modalWallet.currencyCode && (
                <button
                  className={styles.modalBtn}
                  onClick={() => {
                    onChangeCurrency(modalWallet.currencyCode);
                    setModalWallet(null);
                  }}
                >
                  Сделать основным
                </button>
              )}

              <Withdraw />
              <button
                type="button"
                className={styles.depositBtn}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setModalWallet(null);
                  openDepositModal(modalWallet.currencyCode);
                }}
              >
                Пополнить
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent
          className={styles.dialog}
          title="Пополнение счета"
          onInteractOutside={blockIfArmed}
          onPointerDownOutside={blockIfArmed}
        >
          {depositOpen ? (
            <DepositForm forceCurrency={depositCurrency} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
