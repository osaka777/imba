"use client";

import React, { useState, useCallback } from "react";
import styles from "./CategoryItem.module.css";
import type { ProfileCategory } from "./Profile";
import { useRouter } from "next-nprogress-bar";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { toast } from "react-toastify";
import { useLocale } from "~/shared/model/useLocale";
    
export const CategoryItem = React.memo(({
  category,
  variant = 'card',
}: {
  category: ProfileCategory;
  variant?: 'card' | 'row' | 'voucher';
}) => {
    const { t } = useLocale();
    const router = useRouter();
    const [voucherCode, setVoucherCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const activateVoucher = useCallback(async () => {
        if (!voucherCode.trim()) {
            toast.error(t("profile.voucherEnterCode"));
            return;
        }

        setIsLoading(true);
        try {
            const token = await getSessionClient();
            const { data, error } = await api.POST("/api/promo/apply", {
                headers: { Authorization: `Bearer ${token}` },
                body: { code: voucherCode }
            });

            if (error) throw error;

            toast.success(t("profile.voucherActivated"));
            setVoucherCode("");
        } catch (error) {
            console.error("Ошибка при активации ваучера:", error);
            toast.error(t("profile.voucherError"));
        } finally {
            setIsLoading(false);
        }
    }, [voucherCode, t]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            activateVoucher();
        }
    }, [activateVoucher]);

    const handleClick = useCallback(() => {
        if (category.link && !category.inputText) {
            if ('external' in category && category.external) {
                window.open(category.link, '_blank', 'noopener,noreferrer');
                return;
            }
            router.push(category.link);
        }
    }, [category, router]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setVoucherCode(e.target.value);
    }, []);

    const handleInputClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    const isVoucher = variant === 'voucher' || Boolean(category.inputText);
    const isRow = variant === 'row';

    const headerBlock = (
      <div className={styles.sectionContent}>
        <div className={styles.sectionIconWrap}>
          <category.icon className={styles.sectionIconImg} aria-hidden />
        </div>
        <div className={styles.sectionText}>
          <span className={styles.sectionTitle}>{category.name}</span>
          {!isRow && <span className={styles.sectionDesc}>{category.desc}</span>}
        </div>
        {isRow && <span className={styles.sectionArrow}>›</span>}
      </div>
    );

    if (isRow) {
      return (
        <button type="button" className={styles.serviceRow} onClick={handleClick}>
          {headerBlock}
        </button>
      );
    }

    return (
        <div
          className={`${styles.supportSection} ${isVoucher ? styles.supportSectionVoucher : ''}`}
          key={category.id}
          onClick={isVoucher ? undefined : handleClick}
          role={isVoucher ? undefined : 'button'}
          tabIndex={isVoucher ? undefined : 0}
          onKeyDown={isVoucher ? undefined : (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleClick();
            }
          }}
        >
            {headerBlock}
            {category.inputText && (
                <div className={styles.voucherInputContainer} onClick={handleInputClick}>
                    <div className={styles.inputWrapper}>
                        <input 
                            type="text" 
                            className={styles.sectionInput} 
                            placeholder={category.inputText}
                            value={voucherCode}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                        />
                        <button 
                            className={styles.activateButton}
                            onClick={activateVoucher}
                            disabled={isLoading || !voucherCode.trim()}
                        >
                            {isLoading ? "..." : t("profile.voucherActivate")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
