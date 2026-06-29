'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { DepositForm } from '~/entities/finance';
import { getMyUsdtTrc20Order, getUsdtTrc20Config } from '~/entities/finance/api/deposit';
import { AuthForm } from '~/entities/user';
import { verifyUser } from '~/entities/user/api';
import { getSessionClient } from '~/entities/user/lib/getSessionClient';
import { CheckIcon } from '~/shared/assets';
import { cn } from '~/shared/lib';
import { Dialog, DialogContent } from '~/shared/ui';

import {
  USDT_PRESET_AMOUNTS,
  USDT_PROMO_GRADIENT_FROM,
  USDT_PROMO_GRADIENT_TO,
  USDT_PROMO_IMAGE,
  USDT_PROMO_MODAL_SUBTITLE,
  USDT_PROMO_MODAL_TITLE,
  USDT_PROMO_STEP_DEPOSIT,
  USDT_PROMO_STEP_REGISTER,
} from './usdtPromoCopy';
import styles from './LuckyDriveModal.module.css';

type WizardStep = 'intro' | 'deposit' | 'waiting' | 'success';

interface UsdtPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const gradientStyle = {
  backgroundImage: `linear-gradient(155deg, ${USDT_PROMO_GRADIENT_FROM} 0%, ${USDT_PROMO_GRADIENT_TO} 100%)`,
};

export const UsdtPromoModal: React.FC<UsdtPromoModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<WizardStep>('intro');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModalType, setAuthModalType] = useState<'closed' | 'login' | 'register'>('closed');
  const [minAmount, setMinAmount] = useState(10);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<WizardStep>('intro');

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const refresh = useCallback(async (opts?: { keepPage?: boolean }) => {
    const authed = await verifyUser();
    setIsAuthenticated(authed);

    try {
      const config = await getUsdtTrc20Config();
      if (config.minAmount > 0) setMinAmount(config.minAmount);
    } catch {
      /* keep default */
    }

    if (authed && getSessionClient()) {
      try {
        const order = await getMyUsdtTrc20Order();
        if (order && 'id' in order && order.id) {
          if (order.status === 'SUCCESS') {
            setStep('success');
            setError(null);
          } else if (['PENDING', 'PROCESSING'].includes(order.status)) {
            setStep('waiting');
            setError(null);
          } else if (!opts?.keepPage && stepRef.current === 'intro') {
            setStep('intro');
          }
        }
      } catch {
        /* no active order */
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError(null);
    setStep('intro');
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen || (step !== 'waiting' && step !== 'deposit')) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(() => {
      void refresh({ keepPage: true });
    }, 12000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, step, refresh]);

  useEffect(() => {
    if (authModalType !== 'closed') return;
    const t = setTimeout(() => void refresh({ keepPage: true }), 400);
    return () => clearTimeout(t);
  }, [authModalType, refresh]);

  const goToDeposit = () => {
    if (!isAuthenticated) {
      setError('Войдите или зарегистрируйтесь, чтобы продолжить');
      return;
    }
    setError(null);
    setStep('deposit');
  };

  if (!isOpen) return null;

  const isDepositFlow = step === 'deposit' || step === 'waiting';
  const pageIndex = step === 'intro' ? 0 : isDepositFlow ? 1 : 2;

  const stepSubtitle =
    step === 'intro'
      ? USDT_PROMO_MODAL_SUBTITLE
      : step === 'deposit'
        ? `Минимум ${minAmount} USDT. Переводите только TRC-20 — бонус +10% начислится после зачисления.`
        : step === 'waiting'
          ? 'Ожидаем перевод USDT. Бонус +10% начислится автоматически после подтверждения в сети.'
          : step === 'success'
            ? 'Депозит зачислен. Бонус +10% добавлен на баланс.'
            : null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <main className={styles.modalBody}>
            <div className={cn(styles.base, step === 'deposit' && styles.baseDeposit)} style={gradientStyle}>
              {step !== 'success' ? (
                <nav
                  className={cn(styles.stepper, step === 'deposit' && styles.stepperCompact)}
                  aria-label="Шаги"
                >
                  <div className={styles.stepperTrack} aria-hidden>
                    <div
                      className={styles.stepperTrackFill}
                      style={{ width: pageIndex >= 1 ? '100%' : '0%' }}
                    />
                  </div>
                  {['Ознакомление', 'Пополнение'].map((label, index) => (
                    <div
                      key={label}
                      className={cn(
                        styles.stepperItem,
                        index <= pageIndex && styles.stepperItemActive,
                      )}
                    >
                      <span className={styles.stepperDot}>
                        {index < pageIndex ? '✓' : index + 1}
                      </span>
                      <span className={styles.stepperLabel}>{label}</span>
                    </div>
                  ))}
                </nav>
              ) : null}

              <div className={cn(styles.cardScroll, step === 'deposit' && styles.cardScrollDeposit)}>
                {step !== 'deposit' ? (
                  <header className={styles.head}>
                    {step === 'intro' ? (
                      <Image
                        src={USDT_PROMO_IMAGE}
                        alt="USDT"
                        width={72}
                        height={72}
                        className={styles.promoHeroImage}
                      />
                    ) : null}
                    <h2 className={styles.title}>
                      {step === 'waiting'
                        ? 'Ожидаем перевод USDT'
                        : step === 'success'
                          ? 'Готово!'
                          : USDT_PROMO_MODAL_TITLE}
                    </h2>
                    {stepSubtitle ? <p className={styles.subtitle}>{stepSubtitle}</p> : null}
                  </header>
                ) : (
                  <div className={styles.depositHead}>
                    <button
                      type="button"
                      className={styles.depositBackBtn}
                      onClick={() => {
                        setError(null);
                        setStep('intro');
                      }}
                    >
                      ← Назад
                    </button>
                    <div className={styles.depositHeadMain}>
                      <h2 className={styles.depositTitle}>Пополнение USDT</h2>
                      <div className={styles.depositMeta}>
                        <span>от {minAmount} USDT</span>
                        <span className={styles.depositMetaDot} aria-hidden>
                          ·
                        </span>
                        <span className={styles.depositPromo}>TRC-20 · +10%</span>
                      </div>
                    </div>
                  </div>
                )}

                {error ? <div className={styles.errorMessage}>{error}</div> : null}

                {isLoading ? (
                  <div className={styles.loading}>Загрузка...</div>
                ) : (
                  <div className={styles.actions}>
                    {step === 'intro' && (
                      <>
                        <div className={styles.taskList}>
                          <article className={cn(styles.task, isAuthenticated && styles.taskDone)}>
                            <span className={styles.taskNumber}>1</span>
                            <div className={styles.taskBody}>
                              <p className={styles.taskText}>{USDT_PROMO_STEP_REGISTER}</p>
                              {isAuthenticated ? (
                                <span className={styles.taskDoneLabel}>
                                  <CheckIcon className={styles.taskDoneLabelCheckIcon} />
                                  Выполнено
                                </span>
                              ) : (
                                <div className={styles.taskActions}>
                                  <button
                                    type="button"
                                    className={styles.taskBtn}
                                    onClick={() => setAuthModalType('login')}
                                  >
                                    Войти
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(styles.taskBtn, styles.taskBtnSecondary)}
                                    onClick={() => setAuthModalType('register')}
                                  >
                                    Регистрация
                                  </button>
                                </div>
                              )}
                            </div>
                          </article>
                          <article className={styles.task}>
                            <span className={styles.taskNumber}>2</span>
                            <div className={styles.taskBody}>
                              <p className={styles.taskText}>
                                {USDT_PROMO_STEP_DEPOSIT} — от {minAmount} USDT
                              </p>
                              <p className={styles.taskHint}>
                                На следующем шаге отправьте USDT на адрес кошелька TRC-20.
                              </p>
                            </div>
                          </article>
                        </div>
                        <button type="button" className={styles.button} onClick={goToDeposit}>
                          Пополнить USDT
                        </button>
                      </>
                    )}

                    {step === 'deposit' && (
                      <>
                        <div className={styles.depositPanel}>
                          <DepositForm
                            compact
                            embedded
                            modalEmbedded
                            forceCurrency="USDT"
                            defaultAmount={minAmount}
                            presetAmounts={USDT_PRESET_AMOUNTS}
                            depositSource="usdt-promo-modal"
                            onDepositComplete={() => void refresh({ keepPage: true })}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => void refresh({ keepPage: true })}
                        >
                          Проверить статус пополнения
                        </button>
                      </>
                    )}

                    {step === 'waiting' && (
                      <>
                        <div className={styles.waitingCard}>
                          <p className={styles.waitingHint}>
                            Перевод обрабатывается автоматически. Обычно это занимает несколько минут.
                          </p>
                        </div>
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => void refresh({ keepPage: true })}
                        >
                          Обновить статус
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setStep('deposit')}
                        >
                          Вернуться к пополнению
                        </button>
                      </>
                    )}

                    {step === 'success' && (
                      <>
                        <div className={styles.successIcon}>🎉</div>
                        <button type="button" className={styles.button} onClick={onClose}>
                          Играть
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {authModalType !== 'closed' && (
        <Dialog open onOpenChange={() => setAuthModalType('closed')}>
          <DialogContent
            className={styles.authDialog}
            title={authModalType === 'login' ? 'Вход в систему' : 'Регистрация'}
          >
            <AuthForm authVariant={authModalType} className={styles.authForm} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
