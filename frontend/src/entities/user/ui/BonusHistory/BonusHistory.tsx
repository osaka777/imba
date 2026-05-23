"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getSessionClient } from '~/entities/user/lib';
import { api } from '~/shared/api';
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

export const BonusHistory = () => {
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
        <div className={styles.loading}>Загрузка истории бонусов...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>История бонусов</h1>

      {/* Статистика */}
      {bonusStats && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.total}</div>
            <div className={styles.statLabel}>Всего бонусов</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.active}</div>
            <div className={styles.statLabel}>Активных</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.won}</div>
            <div className={styles.statLabel}>Выигранных</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.lost}</div>
            <div className={styles.statLabel}>Проигранных</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{bonusStats.expired}</div>
            <div className={styles.statLabel}>Истекших</div>
          </div>
        </div>
      )}

      {/* Табы */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все ({bonusHistory?.length || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Активные ({bonusStats?.active || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Завершенные ({(bonusStats?.won || 0) + (bonusStats?.lost || 0) + (bonusStats?.expired || 0)})
        </button>
      </div>

      {/* Список бонусов */}
      <div className={styles.bonusList}>
        {filteredHistory.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎁</div>
            <div className={styles.emptyTitle}>История бонусов пуста</div>
            <div className={styles.emptyText}>
              У вас пока нет бонусов. Активируйте промокод, чтобы получить бонус!
            </div>
          </div>
        ) : (
          filteredHistory.map((bonus) => (
            <div key={bonus.id} className={styles.bonusCard}>
              <div className={styles.bonusHeader}>
                <div className={styles.bonusCode}>
                  <span className={styles.codeLabel}>Промокод:</span>
                  <span className={styles.codeValue}>{bonus.promoCode}</span>
                </div>
                <div className={`${styles.bonusStatus} ${getStatusColor(bonus.status)}`}>
                  {bonus.statusText}
                </div>
              </div>

              <div className={styles.bonusInfo}>
                <div className={styles.bonusType}>
                  <span className={styles.typeLabel}>Тип:</span>
                  <span className={styles.typeValue}>{bonus.promoTypeText}</span>
                </div>
                <div className={styles.bonusAmount}>
                  <span className={styles.amountLabel}>Сумма:</span>
                  <span className={styles.amountValue}>
                    {bonus.totalBonusReceived} {bonus.currencyCode}
                  </span>
                </div>
              </div>

              {/* Прогресс отыгрыша */}
              {bonus.status === 'PENDING' && (
                <div className={styles.bonusProgress}>
                  <div className={styles.progressHeader}>
                    <span>Прогресс отыгрыша</span>
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
                      Жетоны: {bonus.remainingTokens} / {bonus.totalTokens}
                    </div>
                  ) : (
                    <div className={styles.wagerInfo}>
                      Отыграно: {bonus.totalWagered} / {bonus.requiredWager} {bonus.currencyCode}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.bonusDates}>
                <div className={styles.dateItem}>
                  <span className={styles.dateLabel}>Активирован:</span>
                  <span className={styles.dateValue}>
                    {format(new Date(bonus.appliedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </span>
                </div>
                {bonus.expiredAt && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>Истекает:</span>
                    <span className={styles.dateValue}>
                      {format(new Date(bonus.expiredAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                )}
                {bonus.completedAt && (
                  <div className={styles.dateItem}>
                    <span className={styles.dateLabel}>Завершен:</span>
                    <span className={styles.dateValue}>
                      {format(new Date(bonus.completedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                )}
              </div>

              {bonus.notes && (
                <div className={styles.bonusNotes}>
                  <span className={styles.notesLabel}>Примечание:</span>
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