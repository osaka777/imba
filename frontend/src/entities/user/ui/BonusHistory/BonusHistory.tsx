"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { az, enUS, es, kk, ptBR, ru, tr, uk, uz } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { getSessionClient } from '~/entities/user/lib';
import { api } from '~/shared/api';
import type { AppLocale } from '~/shared/i18n/locale';
import { useLocale } from '~/shared/model/useLocale';
import styles from './BonusHistory.module.css';

interface BonusHistoryItem {
  id: number;
  promoCode: string;
  promoType: string;
  promoTypeText: string;
  status: 'PENDING' | 'WIN' | 'LOSE' | 'EXPIRED' | 'CANCELLED';
  statusText: string;
  appliedAt: string;
  expiredAt?: string;
  completedAt?: string;
  totalBonusReceived: string;
  totalWagered: string;
  requiredWager: string;
  consecutiveWins: number;
  requiredConsecutiveWins: number;
  totalTokens: number;
  remainingTokens: number;
  tokensPerBet: number;
  isTokenBased: boolean;
  currencyCode: string;
  notes?: string;
  progressPercentage: number;
}

interface BonusStats {
  total: number;
  active: number;
  won: number;
  lost: number;
  expired: number;
  totalBonusReceived: string;
  totalWagered: string;
}

const DATE_LOCALES: Record<AppLocale, Locale> = {
  ru,
  en: enUS,
  kk,
  uz,
  tr,
  uk,
  az,
  es,
  pt: ptBR,
};

export const BonusHistory = () => {
  const { t, locale } = useLocale();
  const dateLocale = DATE_LOCALES[locale] ?? ru;
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const token = getSessionClient();

  const { data: bonusHistory, isLoading: historyLoading } = useQuery<BonusHistoryItem[]>({
    queryKey: ['bonus-history'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const { data, error } = await api.GET('/api/bonus-balance/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });

  const { data: bonusStats, isLoading: statsLoading } = useQuery<BonusStats>({
    queryKey: ['bonus-stats'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const { data, error } = await api.GET('/api/bonus-balance/history/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
  });

  const filteredHistory = bonusHistory?.filter(item => {
    switch (activeTab) {
      case 'active':
        return item.status === 'PENDING';
      case 'completed':
        return ['WIN', 'LOSE', 'EXPIRED', 'CANCELLED'].includes(item.status);
      default:
        return true;
    }
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return styles.statusPending;
      case 'WIN':
        return styles.statusWin;
      case 'LOSE':
        return styles.statusLose;
      case 'EXPIRED':
        return styles.statusExpired;
      case 'CANCELLED':
        return styles.statusCancelled;
      default:
        return styles.statusUnknown;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return styles.progressHigh;
    if (percentage >= 50) return styles.progressMedium;
    return styles.progressLow;
  };

  if (historyLoading || statsLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t("profile.bonusHistLoading")}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t("profile.bonusHistTitle")}</h1>

      {bonusStats && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.total}</div>
            <div className={styles.statLabel}>{t("profile.bonusHistTotal")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.active}</div>
            <div className={styles.statLabel}>{t("profile.bonusHistActive")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.won}</div>
            <div className={styles.statLabel}>{t("profile.bonusHistWon")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.lost}</div>
            <div className={styles.statLabel}>{t("profile.bonusHistLost")}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.expired}</div>
            <div className={styles.statLabel}>{t("profile.bonusHistExpired")}</div>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          {t("profile.bonusHistTabAll", { n: bonusHistory?.length || 0 })}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
          onClick={() => setActiveTab('active')}
        >
          {t("profile.bonusHistTabActive", { n: bonusStats?.active || 0 })}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          {t("profile.bonusHistTabCompleted", {
            n: (bonusStats?.won || 0) + (bonusStats?.lost || 0) + (bonusStats?.expired || 0),
          })}
        </button>
      </div>

      <div className={styles.bonusList}>
        {filteredHistory.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎁</div>
            <div className={styles.emptyTitle}>{t("profile.bonusHistEmptyTitle")}</div>
            <div className={styles.emptyText}>{t("profile.bonusHistEmptyText")}</div>
          </div>
        ) : (
          filteredHistory.map((bonus) => (
            <div key={bonus.id} className={styles.bonusCard}>
              <div className={styles.bonusHeader}>
                <div className={styles.bonusCode}>
                  <span className={styles.codeLabel}>{t("profile.bonusHistPromo")}</span>
                  <span className={styles.codeValue}>{bonus.promoCode}</span>
                </div>
                <div className={`${styles.bonusStatus} ${getStatusColor(bonus.status)}`}>
                  {bonus.statusText}
                </div>
              </div>

              <div className={styles.bonusInfo}>
                <div className={styles.bonusType}>
                  <span className={styles.typeLabel}>{t("profile.bonusHistType")}</span>
                  <span className={styles.typeValue}>{bonus.promoTypeText}</span>
                </div>
                <div className={styles.bonusAmount}>
                  <span className={styles.amountLabel}>{t("profile.bonusHistAmount")}</span>
                  <span className={styles.amountValue}>
                    {bonus.totalBonusReceived} {bonus.currencyCode}
                  </span>
                </div>
              </div>

              {bonus.status === 'PENDING' && (
                <div className={styles.bonusProgress}>
                  <div className={styles.progressHeader}>
                    <span>{t("profile.bonusHistProgress")}</span>
                    <span className={styles.progressPercentage}>
                      {bonus.progressPercentage}%
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progressFill} ${getProgressColor(bonus.progressPercentage)}`}
                      style={{ width: `${bonus.progressPercentage}%` }}
                    />
                  </div>
                  {bonus.isTokenBased ? (
                    <div className={styles.tokenInfo}>
                      {t("profile.bonusHistTokens", {
                        left: bonus.remainingTokens,
                        total: bonus.totalTokens,
                      })}
                    </div>
                  ) : (
                    <div className={styles.wagerInfo}>
                      {t("profile.bonusHistWagered", {
                        current: bonus.totalWagered,
                        required: bonus.requiredWager,
                        currency: bonus.currencyCode,
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.bonusDates}>
                <div className={styles.dateItem}>
                  <span className={styles.dateLabel}>{t("profile.bonusHistActivated")}</span>
                  <span className={styles.dateValue}>
                    {format(new Date(bonus.appliedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                  </span>
                </div>
                {bonus.expiredAt && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>{t("profile.bonusHistExpires")}</span>
                    <span className={styles.dateValue}>
                      {format(new Date(bonus.expiredAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                    </span>
                  </div>
                )}
                {bonus.completedAt && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>{t("profile.bonusHistCompleted")}</span>
                    <span className={styles.dateValue}>
                      {format(new Date(bonus.completedAt), 'dd.MM.yyyy HH:mm', { locale: dateLocale })}
                    </span>
                  </div>
                )}
              </div>

              {bonus.notes && (
                <div className={styles.bonusNotes}>
                  <span className={styles.notesLabel}>{t("profile.bonusHistNotes")}</span>
                  <span className={styles.notesValue}>{bonus.notes}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
