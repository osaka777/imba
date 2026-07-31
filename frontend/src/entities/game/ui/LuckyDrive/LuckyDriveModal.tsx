'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DepositForm } from '~/entities/finance';
import { verifyUser } from '~/entities/user/api';
import { getSessionClient } from '~/entities/user/lib/getSessionClient';
import {
  claimPromoModalBonus,
  fetchPromoModalSettings,
  fetchPromoModalStatus,
  type PublicPromoModalSettings,
  type PromoModalUserStatus,
} from '~/entities/promo-modal/api/client';
import { CheckIcon } from '~/shared/assets';
import { cn } from '~/shared/lib';

import { ModalInlineAuth } from './ModalInlineAuth';
import { IMBA_GAMES_MODAL_TITLE } from './luckyDriveImage';
import { useLocale } from '~/shared/model/useLocale';
import styles from './LuckyDriveModal.module.css';

type WizardStep = 'intro' | 'deposit' | 'waiting' | 'claim' | 'success';

interface LuckyDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function resolveStatusStep(
  authed: boolean,
  status: PromoModalUserStatus | null,
  settings: PublicPromoModalSettings | null,
): WizardStep | null {
  if (!authed) return null;
  if (status?.bonusReceived) return 'success';
  if (status?.canClaimDirect) return 'claim';
  if (status?.bonusPending || status?.pendingDeposit) return 'waiting';
  if (settings?.promoType === 'DEPOSIT_BONUS' && status?.minDepositMet && !status.promoUsed) {
    return 'waiting';
  }
  if (status?.minDepositMet && settings?.promoType === 'DIRECT_BONUS' && !status.promoUsed) {
    return 'claim';
  }
  return null;
}

export const LuckyDriveModal: React.FC<LuckyDriveModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocale();
  const router = useRouter();
  const [settings, setSettings] = useState<PublicPromoModalSettings | null>(null);
  const [status, setStatus] = useState<PromoModalUserStatus | null>(null);
  const [step, setStep] = useState<WizardStep>('intro');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authModalType, setAuthModalType] = useState<'closed' | 'login' | 'register'>('closed');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<WizardStep>('intro');

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const refresh = useCallback(async (opts?: { keepPage?: boolean; manualCheck?: boolean }) => {
    const publicSettings = await fetchPromoModalSettings();
    setSettings(publicSettings);
    if (!publicSettings?.enabled) {
      setIsLoading(false);
      return;
    }

    const authed = await verifyUser();
    setIsAuthenticated(authed);

    let userStatus: PromoModalUserStatus | null = null;
    const token = getSessionClient();
    if (authed && token) {
      userStatus = await fetchPromoModalStatus(token);
      setStatus(userStatus);
    } else {
      setStatus(null);
    }

    const statusStep = resolveStatusStep(authed, userStatus, publicSettings);
    if (statusStep) {
      setStep(statusStep);
      setError(null);
    } else if (!opts?.keepPage) {
      setStep('intro');
      setError(null);
    } else if (stepRef.current === 'deposit') {
      setStep('deposit');
      if (opts?.manualCheck) {
        setError(t('promo.gameNoActiveOrder'));
      }
    } else if (opts?.manualCheck) {
      setError(null);
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

  const gradientStyle = useMemo(
    () =>
      settings
        ? {
            backgroundImage: `linear-gradient(143deg, ${settings.gradientFrom} 0.74%, ${settings.gradientTo} 141.93%)`,
          }
        : undefined,
    [settings],
  );

  const handleClaim = async () => {
    const token = getSessionClient();
    if (!token) return;
    setActionLoading(true);
    setError(null);
    try {
      await claimPromoModalBonus(token);
      await refresh({ keepPage: true });
      setStep('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('promo.gameClaimFail'));
    } finally {
      setActionLoading(false);
    }
  };

  const goToWc = () => {
    const path = settings?.wcRedirectPath || status?.wcRedirectPath || '/wc';
    onClose();
    router.push(path);
  };

  const goToDeposit = () => {
    if (!isAuthenticated) {
      setError(t('promo.authRequired'));
      return;
    }
    setError(null);
    setStep('deposit');
  };

  if (!isOpen) return null;

  if (!isLoading && settings && !settings.enabled) {
    return null;
  }

  const isDepositFlow = step === 'deposit' || step === 'waiting' || step === 'claim';
  const pageIndex = step === 'intro' ? 0 : isDepositFlow ? 1 : 2;

  const stepSubtitle =
    step === 'intro'
      ? t('promo.gameModalSubtitle')
      : step === 'deposit'
        ? settings
          ? t('promo.gameDepositHint', { min: settings.minDepositLabel, code: settings.promoCode })
          : null
        : step === 'waiting'
          ? t('promo.gameWaitingSubtitle')
          : step === 'claim'
            ? t('promo.gameClaimSubtitle')
            : step === 'success'
              ? t('promo.gameSuccessSubtitle')
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
                  <h2 className={styles.title}>
                    {step === 'waiting'
                        ? t('promo.gameWaitingTitle')
                        : step === 'claim'
                          ? t('promo.gameClaimTitle')
                          : step === 'success'
                            ? t('promo.readyExclaim')
                            : IMBA_GAMES_MODAL_TITLE}
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
                    <h2 className={styles.depositTitle}>{t('promo.gameDepositTitle')}</h2>
                    {settings ? (
                      <div className={styles.depositMeta}>
                        <span>{t('promo.fromAmount', { amount: settings.minDepositLabel })}</span>
                        <span className={styles.depositMetaDot} aria-hidden>
                          ·
                        </span>
                        <span className={styles.depositPromo}>{settings.promoCode}</span>
                      </div>
                    ) : null}
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
                              <p className={styles.taskText}>{t('promo.gameStepRegister')}</p>
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
                                {t('promo.gameStepDeposit')}
                              </p>
                              <p className={styles.taskHint}>
                                {t('promo.gameTaskHint')}
                              </p>
                            </div>
                          </article>
                        </div>
                        <button type="button" className={styles.button} onClick={goToDeposit}>
                          {t('promo.next')}
                        </button>
                      </>
                    )}

                    {step === 'deposit' && settings && (
                      <>
                        <div className={styles.depositPanel}>
                          <DepositForm
                            compact
                            embedded
                            modalEmbedded
                            forceCurrency={settings.minDepositCurrency}
                            defaultAmount={settings.minDepositAmount}
                            presetAmounts={settings.presetAmounts}
                            initialVoucher={settings.promoCode}
                            depositSource="wc-promo-modal"
                            onDepositComplete={() => void refresh({ keepPage: true })}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => void refresh({ keepPage: true, manualCheck: true })}
                        >
                          {t('promo.checkDepositStatus')}
                        </button>
                      </>
                    )}

                    {step === 'waiting' && (
                      <>
                        <div className={styles.waitingCard}>
                          {status?.pendingDeposit ? (
                            <>
                              <p>{t('promo.gameOrderId', { id: status.pendingDeposit.id })}</p>
                              <p className={styles.waitingAmount}>
                                {status.pendingDeposit.amount.toLocaleString('ru-RU')}{' '}
                                {status.pendingDeposit.currency}
                              </p>
                              <p className={styles.waitingHint}>
                                {t('promo.gameWaitingAdmin')}
                              </p>
                            </>
                          ) : (
                            <p className={styles.waitingHint}>{t('promo.gameCheckingStatus')}</p>
                          )}
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

                    {step === 'claim' && (
                      <button
                        type="button"
                        className={styles.button}
                        disabled={actionLoading}
                        onClick={() => void handleClaim()}
                      >
                        {actionLoading ? t('promo.gameClaiming') : t('promo.gameCta')}
                      </button>
                    )}

                    {step === 'success' && (
                      <>
                        <div className={styles.successIcon}>🎉</div>
                        <button type="button" className={styles.button} onClick={goToWc}>
                          {t('promo.gamePlay')}
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
