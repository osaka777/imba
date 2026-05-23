import React, { useState, useCallback } from "react";
import styles from "./CategoryItem.module.css";
import { PROFILE_CATEGORIES } from "./Profile";
import { useRouter } from "next-nprogress-bar";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { toast } from "react-toastify";
    
export const CategoryItem = React.memo(({ category }: { category: typeof PROFILE_CATEGORIES[0] }) => {
    const router = useRouter();
    const [voucherCode, setVoucherCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const activateVoucher = useCallback(async () => {
        if (!voucherCode.trim()) {
            toast.error("Пожалуйста, введите код ваучера");
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

            toast.success("Ваучер успешно активирован!");
            setVoucherCode("");
        } catch (error) {
            console.error("Ошибка при активации ваучера:", error);
            toast.error("Ошибка при активации ваучера");
        } finally {
            setIsLoading(false);
        }
    }, [voucherCode]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            activateVoucher();
        }
    }, [activateVoucher]);

    const handleClick = useCallback(() => {
        if (category.link && !category.inputText) {
            router.push(category.link);
        }
    }, [category.link, category.inputText, router]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setVoucherCode(e.target.value);
    }, []);

    const handleInputClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div className={styles.supportSection} key={category.id} onClick={handleClick}>
            <div className={styles.sectionContent}>
                <div className={styles.sectionHeader}>
                    <span className={styles.sectionHeaderTitle}>{category.name}</span>
                    <span className={styles.sectionDesc}>{category.desc}</span>
                </div>
                <category.icon className={styles.sectionIconImg} />
            </div>
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
                            {isLoading ? "..." : "Активировать"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});