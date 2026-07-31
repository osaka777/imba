'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { DepositForm } from '~/entities/finance';
import { getMyUsdtTrc20Order, getUsdtTrc20Config } from '~/entities/finance/api/deposit';
import { verifyUser } from '~/entities/user/api';
import { getSessionClient } from '~/entities/user/lib/getSessionClient';
import { CheckIcon } from '~/shared/assets';
import { cn } from '~/shared/lib';

import { ModalInlineAuth } from './ModalInlineAuth';
import {
  USDT_PRESET_AMOUNTS,
  USDT_PROMO_GRADIENT_FROM,
  USDT_PROMO_GRADIENT_TO,
  USDT_PROMO_IMAGE,
} from './usdtPromoCopy';
import { useLocale } from '~/shared/model/useLocale';
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
  const { t } = useLocale();
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
    if (!isOpen) {
      setAuthModalType('closed');
      return;
    }
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
      setError(t('promo.authRequired'));
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
      ? t('promo.usdtModalSubtitle')
      : step === 'deposit'
        ? t('promo.usdtDepositHint', { min: minAmount })
        : step === 'waiting'
          ? t('promo.usdtWaitingSubtitle')
          : step === 'success'
            ? t('promo.usdtSuccessSubtitle')
            : null;

  const showAuth = authModalType !== 'closed';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={cn(styles.modalContent, showAuth && styles.modalContentAuth)} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t("promo.close")}>
          ×
        </button>
        <main className={styles.modalBody}>
          {showAuth ? (
            <ModalInlineAuth
              variant={authModalType}
              onBack={() => setAuthModalType('closed')}
              backLabel={t("promo.backToPromo")}
            />
          ) : (
            <div className={cn(styles.base, step === 'deposit' && styles.baseDeposit)} style={gradientStyle}>
              {step !== 'success' ? (
                <nav
                  className={cn(styles.stepper, step === 'deposit' && styles.stepperCompact)}
                  aria-label={t("promo.stepsAria")}
                >
                  <div className={styles.stepperTrack} aria-hidden>
                    <div
                      className={styles.stepperTrackFill}
                      style={{ width: pageIndex >= 1 ? '100%' : '0%' }}
                    />
                  </div>
                  {[t('promo.stepIntro'), t('promo.stepDeposit')].map((label, index) => (
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
                        ? t('promo.usdtWaitingTitle')
                        : step === 'success'
                          ? t('promo.readyExclaim')
                          : t('promo.usdtModalTitle')}
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
                      {t('promo.back')}
                    </button>
                    <div className={styles.depositHeadMain}>
                      <h2 className={styles.depositTitle}>{t('promo.usdtDepositTitle')}</h2>
                      <div className={styles.depositMeta}>
                        <span>{t('promo.fromAmount', { amount: `${minAmount} USDT` })}</span>
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
                  <div className={styles.loading}>{t('promo.loading')}</div>
                ) : (
                  <div className={styles.actions}>
                    {step === 'intro' && (
                      <>
                        <div className={styles.taskList}>
                          <article className={cn(styles.task, isAuthenticated && styles.taskDone)}>
                            <span className={styles.taskNumber}>1</span>
                            <div className={styles.taskBody}>
                              <p className={styles.taskText}>{t('promo.usdtStepRegister')}</p>
                              {isAuthenticated ? (
                                <span className={styles.taskDoneLabel}>
                                  <CheckIcon className={styles.taskDoneLabelCheckIcon} />
                                  {t('promo.done')}
                                </span>
                              ) : (
                                <div className={styles.taskActions}>
                                  <button
                                    type="button"
                                    className={styles.taskBtn}
                                    onClick={() => setAuthModalType('login')}
                                  >
                                    {t('promo.login')}
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(styles.taskBtn, styles.taskBtnSecondary)}
                                    onClick={() => setAuthModalType('register')}
                                  >
                                    {t('promo.register')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </article>
                          <article className={styles.task}>
                            <span className={styles.taskNumber}>2</span>
                            <div className={styles.taskBody}>
                              <p className={styles.taskText}>
                                {t('promo.usdtStepDepositFrom', { step: t('promo.usdtStepDeposit'), min: minAmount })}
                              </p>
                              <p className={styles.taskHint}>
                                {t('promo.usdtTaskHint')}
                              </p>
                            </div>
                          </article>
                        </div>
                        <button type="button" className={styles.button} onClick={goToDeposit}>
                          {t('promo.usdtDepositCta')}
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
                          {t('promo.checkDepositStatus')}
                        </button>
                      </>
                    )}

                    {step === 'waiting' && (
                      <>
                        <div className={styles.waitingCard}>
                          <p className={styles.waitingHint}>
                            {t('promo.usdtWaitingAuto')}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => void refresh({ keepPage: true })}
                        >
                          {t('promo.refreshStatus')}
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setStep('deposit')}
                        >
                          {t('promo.backToDeposit')}
                        </button>
                      </>
                    )}

                    {step === 'success' && (
                      <>
                        <div className={styles.successIcon}>🎉</div>
                        <button type="button" className={styles.button} onClick={onClose}>
                          {t('promo.usdtPlay')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
