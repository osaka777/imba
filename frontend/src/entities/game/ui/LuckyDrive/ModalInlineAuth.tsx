'use client';

import { AuthForm } from '~/entities/user';
import { cn } from '~/shared/lib';
import { useLocale } from '~/shared/model/useLocale';

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
  backLabel,
  className,
}: ModalInlineAuthProps) {
  const { t } = useLocale();
  return (
    <div className={cn(styles.authShell, className)}>
      <button type="button" className={styles.authBack} onClick={onBack}>
        {backLabel ?? t('promo.backToPromo')}
      </button>
      <h2 className={styles.authTitle}>
        {variant === 'login' ? t('promo.authLoginTitle') : t('promo.authRegisterTitle')}
      </h2>
      <AuthForm authVariant={variant} className={styles.authForm} />
    </div>
  );
}
