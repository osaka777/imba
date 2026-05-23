"use client";
import React, { useEffect, useState } from "react";
import { getOperations } from "@/entities/user/api/getOperations";
import styles from "@/app/profile/withdrawal/withdrawal.module.css";

export const PaymentInfo = () => {
    const [operations, setOperations] = useState<{
        amount: number;
    }>({
        amount: 0
    })

    useEffect(() => {
        const fetchData = async () => {
            const data = await getOperations();
            if(data) {
                setOperations(data)
            }
        }
        fetchData()
    }, []);

    return (
        <div className={styles.stats}>
            <div className={styles.stats_header}>
                Информация о выводах:
            </div>
            <hr className={styles.stats_hr} />
            <div className={styles.stats_info}>
                <div className={styles.stats_item}>
                    <div className={styles.stats_item_name}>Количество выводов:</div>
                    <div className={styles.stats_item_value}>{operations.amount}</div>
                </div>
            </div>
        </div>
    );
};