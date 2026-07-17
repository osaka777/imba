'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { verifyUser, getUser } from '~/entities/user/api';
import { useCurrency } from '~/shared/model/useCurrency';
import { cn } from '~/shared/lib';

import { ModalInlineAuth } from './ModalInlineAuth';
import {
  WELCOME_MODAL_TITLE,
  WELCOME_RULES,
} from './welcomeBonusCopy';
import { formatWelcomeMoney, getWelcomeLimit } from './welcomeBonusLimits';
import { buildWelcomeDepositPath } from './welcomeBonusDeposit';
import {
  resolveWelcomeTimeline,
  type WelcomeBonusSnapshot,
} from './welcomeBonusTimeline';
import baseStyles from './LuckyDriveModal.module.css';
import styles from './WelcomeBonusModal.module.css';

interface WelcomeBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeBonusModal: React.FC<WelcomeBonusModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { currency } = useCurrency();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalType, setAuthModalType] = useState<'closed' | 'login' | 'register'>('closed');

  const userLimit = getWelcomeLimit(currency);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: getUser,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const bonus = useMemo(
    () =>
      (user?.bonusBalances as WelcomeBonusSnapshot[] | undefined)?.find(
        (b) => b.currencyCode === currency,
      ),
    [user?.bonusBalances, currency],
  );

  const timeline = useMemo(
    () => resolveWelcomeTimeline({ isAuthenticated, bonus, currency }),
    [isAuthenticated, bonus, currency],
  );

  const refresh = useCallback(async () => {
    const authed = await verifyUser();
    setIsAuthenticated(authed);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setAuthModalType('closed');
      return;
    }
    setIsLoading(true);
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (authModalType !== 'closed') return;
    const t = setTimeout(() => void refresh(), 400);
    return () => clearTimeout(t);
  }, [authModalType, refresh]);

  const goDeposit = () => {
    onClose();
    router.push(buildWelcomeDepositPath(currency));
  };

  const goAction = () => {
    if (!isAuthenticated) {
      setAuthModalType('register');
      return;
    }
    if (timeline.currentStep >= 4 && timeline.ctaLabel.includes('ставк')) {
      onClose();
      router.push('/');
      return;
    }
    if (timeline.ctaLabel === 'В профиль') {
      onClose();
      router.push('/profile');
      return;
    }
    goDeposit();
  };

  if (!isOpen) return null;

  const showAuth = authModalType !== 'closed';

  return (
    <div className={baseStyles.modalOverlay} onClick={onClose}>
      <div className={cn(baseStyles.modalContent, showAuth && baseStyles.modalContentAuth)} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={baseStyles.closeBtn} onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <main className={baseStyles.modalBody}>
          {showAuth ? (
            <ModalInlineAuth
              variant={authModalType}
              onBack={() => setAuthModalType('closed')}
              backLabel="← Назад к welcome-бонусу"
            />
          ) : (
            <div className={styles.shell}>
              <div className={styles.scroll}>
                <header className={styles.head}>
                  <div className={styles.badgeRow}>
                    <span className={cn(styles.badge, styles.badgeAccent)}>40% бонус</span>
                    <span className={styles.badge}>Вейджер ×8</span>
                    <span className={styles.badge}>24 часа</span>
                  </div>
                  <div className={styles.iconWrap} aria-hidden>
                    🎁
                  </div>
                  <h2 className={styles.title}>{WELCOME_MODAL_TITLE}</h2>
                  <p className={styles.subtitle}>{timeline.subline}</p>
                </header>

                {isLoading ? (
                  <div className={baseStyles.loading}>Загрузка...</div>
                ) : (
                  <>
                    <div className={styles.progressCard}>
                      <div className={styles.progressHead}>
                        <span className={styles.progressLabel}>Ваш путь к бонусу</span>
                        <span className={styles.progressValue}>{timeline.progressPct}%</span>
                      </div>
                      <div className={styles.progressTrack} aria-hidden>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${timeline.progressPct}%` }}
                        />
                      </div>
                      <p className={styles.progressHeadline}>{timeline.headline}</p>
                      {timeline.timeLeft && timeline.timeLeft !== 'истёк' ? (
                        <p className={styles.progressTimer}>⏱ Осталось: {timeline.timeLeft}</p>
                      ) : null}
                    </div>

                    <div className={styles.steps}>
                      {timeline.steps.map((step) => (
                        <article
                          key={step.n}
                          className={cn(
                            styles.stepItem,
                            step.status === 'done' && styles.stepItemDone,
                            step.status === 'current' && styles.stepItemCurrent,
                            step.status === 'upcoming' && styles.stepItemUpcoming,
                            step.status === 'expired' && styles.stepItemExpired,
                          )}
                        >
                          <span
                            className={cn(
                              styles.stepDot,
                              step.status === 'done' && styles.stepDotDone,
                              step.status === 'current' && styles.stepDotCurrent,
                            )}
                            aria-hidden
                          >
                            {step.status === 'done' ? '✓' : step.n}
                          </span>
                          <div className={styles.stepBody}>
                            <div className={styles.stepTitleRow}>
                              <p className={styles.stepTitle}>{step.title}</p>
                              {step.actionLabel ? (
                                <span className={styles.stepBadge}>{step.actionLabel}</span>
                              ) : null}
                              {step.status === 'done' ? (
                                <span className={styles.stepDoneBadge}>Готово</span>
                              ) : null}
                            </div>
                            <p className={styles.stepText}>{step.text}</p>
                            {step.status === 'current' && step.n === 4 && timeline.wagerPct > 0 ? (
                              <div className={styles.stepWagerBar} aria-hidden>
                                <div
                                  className={styles.stepWagerFill}
                                  style={{ width: `${timeline.wagerPct}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className={styles.limitsPanel}>
                      <div className={styles.limitsHead}>
                        <p className={styles.limitsLabel}>Ваши лимиты</p>
                        <p className={styles.limitsCurrency}>{userLimit.label}</p>
                      </div>
                      <div className={styles.limitsGrid}>
                        <div className={styles.limitStat}>
                          <span className={styles.limitStatLabel}>Мин. депозит</span>
                          <span className={styles.limitStatValue}>
                            {formatWelcomeMoney(userLimit.minDeposit, userLimit.currency)}
                          </span>
                        </div>
                        <div className={styles.limitStat}>
                          <span className={styles.limitStatLabel}>Макс. бонус</span>
                          <span className={styles.limitStatValue}>
                            до {formatWelcomeMoney(userLimit.maxBonus, userLimit.currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.rulesSection}>
                      <p className={styles.rulesTitle}>Условия отыгрыша</p>
                      <div className={styles.rulesGrid}>
                        {WELCOME_RULES.map((rule) => (
                          <article key={rule.title} className={styles.ruleCard}>
                            <div className={styles.ruleIcon}>{rule.icon}</div>
                            <p className={styles.ruleTitle}>{rule.title}</p>
                            <p className={styles.ruleText}>{rule.text}</p>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className={baseStyles.actions}>
                      {isAuthenticated ? (
                        <button type="button" className={baseStyles.button} onClick={goAction}>
                          {timeline.ctaLabel}
                        </button>
                      ) : (
                        <div className={baseStyles.taskActions}>
                          <button
                            type="button"
                            className={baseStyles.taskBtn}
                            onClick={() => setAuthModalType('register')}
                          >
                            Регистрация
                          </button>
                          <button
                            type="button"
                            className={cn(baseStyles.taskBtn, baseStyles.taskBtnSecondary)}
                            onClick={() => setAuthModalType('login')}
                          >
                            Войти
                          </button>
                        </div>
                      )}
                      <Link href="/guides/bonusy" className={styles.footerLink} onClick={onClose}>
                        Подробный гид по бонусам →
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
