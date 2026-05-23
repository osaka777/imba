"use client";

import React from 'react';
import { BonusHistory } from '~/entities/user/ui/BonusHistory/BonusHistory';
import styles from './BonusHistoryModal.module.css';

interface BonusHistoryModalProps {
  onClose: () => void;
}

export const BonusHistoryModal: React.FC<BonusHistoryModalProps> = ({ onClose }) => {
  return (
    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>История бонусов</h2>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className={styles.modalContent}>
        <BonusHistory />
      </div>
    </div>
  );
}; 