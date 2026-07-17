"use client";
import React, { useEffect, useState } from "react";
import styles from "@/app/profile/withdrawal/withdrawal.module.css";
import { LogoIcon } from "@/shared/assets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/UI/select";
import { IBalances } from "@/entities/user/interface/IBalances";
import { getBalances } from "@/entities/user/api/getBalances";
import { withdraw } from "@/entities/user/api/withdraw";
import axios, { AxiosResponse } from "axios";


export const WithdrawalCard = () => {

    const [currency, setCurrency] = useState("")
    const [error, setError] = useState("")
    const [email, setEmail] = useState("")
    const [currencies, setCurrencies] = useState<{
        label: string;
        value: string;
    }[]>([])
    const [amount, setAmount] = useState(0)

    useEffect(() => {
        const setBalances = async () => {
            const data = await getBalances();
            if (data) {
                setCurrency(data[0]?.currencyCode ?? "USD");
                data.slice(1).forEach(e => {
                    setCurrencies(prev => [
                        ...prev,
                        {
                            label: e.currencyCode,
                            value: e.currencyCode,
                        },
                    ]);
                });
            }
        };

        const getEmail = async () => {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const data = await response.json();
                    setEmail(data.email);
                }
            } catch (error) {
                console.error('Failed to fetch user email:', error);
            }
        };

        setBalances();
        getEmail();
    }, []); // ESLint теперь не будет ругаться

    const submit = async () => {
        const resp = await withdraw({
            amount: Number(amount),
            currency
        })
        if (resp?.error) {
            setError(resp.message)
        }
    }

    return (
        <div className={styles.card}>
            <div className={styles.card_header}>
                <div className={styles.card_header_logo}>
                    <LogoIcon />
                </div>
                <div className={styles.card_header_text}>
                    world
                </div>
            </div>
            <div className={styles.card_email}>
                {email}
            </div>
            <div className={styles.card_actions_wrapper}>
                <div className={styles.card_actions}>
                    <input type={"number"} min={0} placeholder={"Сумма"} value={amount} onChange={e => setAmount(Number(e.target.value))} className={`${styles.card_input} withdrawal_card_input`} />
                    <Select onValueChange={(e) => setCurrency(e)} value={currency}>
                        <SelectTrigger className="h-7 w-20">
                            <SelectValue suppressHydrationWarning>{currency}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {currencies.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <button onClick={submit} className={styles.card_submit}>Вывести</button>

                </div>
                {
                    error !== "" && <p className={styles.error}>{error}</p>
                }
            </div>
        </div>
    );
};