'use client';
import React, { useEffect, useState } from "react";
import styles from "@/app/profile/withdrawal/withdrawal.module.css";
import { SadSmile } from "@/shared/assets/icons";
import { getOperations } from "@/entities/user/api/getOperations";

export const PaymentTable = () => {

    const [operations, setOperations] = useState<{
        data: any[]
    }>({data: []})

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
        <div className={styles.payment_info}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>Создано</th>
                    <th>Сумма</th>
                    <th>Валюта</th>
                    <th>Статус</th>
                </tr>
                </thead>
                <tbody>
                {operations.data && operations.data.map(elem => <tr key={elem.id}>
                    <th>{elem.createdAt.split("T")[0] + " " + elem.createdAt.split("T")[1].split(".")[0]}</th>
                    <th>{elem.amount.d[0]}</th>
                    <th>{elem.currencyCode}</th>
                    <th>{elem.status}</th>
                </tr>)}
                </tbody>
            </table>
            {
                operations?.data?.length < 1 &&
                <div className={styles.table_none}>
                <SadSmile />
                    Ничего не найдено
                </div>
            }
        </div>
    );
};