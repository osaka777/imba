'use client';

import { AuthForm } from '~/entities/user';
import { cn } from '~/shared/lib';

import styles from './LuckyDriveModal.module.css';

type ModalInlineAuthProps = {
  variant: 'login' | 'register';
  onBack: () => void;
  backLabel?: string;
  className?: string;
};

export function ModalInlineAuth({
  variant,
  onBack,
  backLabel = '← Назад к акции',
  className,
}: ModalInlineAuthProps) {
  return (
    <div className={cn(styles.authShell, className)}>
      <button type="button" className={styles.authBack} onClick={onBack}>
        {backLabel}
      </button>
      <h2 className={styles.authTitle}>
        {variant === 'login' ? 'Вход в систему' : 'Регистрация'}
      </h2>
      <AuthForm authVariant={variant} className={styles.authForm} />
    </div>
  );
}
