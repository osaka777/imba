"use client";
import React, { useEffect, useState } from "react";
import header from "@/widgets/ProfileHeader/header.module.css";
import { IStats } from "@/entities/user/interface/IStats";
import { getStats } from "@/entities/user/api/getStats";
import { IBalances } from "@/entities/user/interface/IBalances";
import { getBalances } from "@/entities/user/api/getBalances";

export const Balance = () => {
    const [isOpen, setOpen] = useState(false)
    const [stats, setStats] = useState<IBalances[]>([]);

    useEffect(() => {
        const setBalances = async () => {
            const data = await getBalances();
            if(data) {
                setStats(data);
            }
        };
        setBalances();
    }, []);

    return (
        <div onClick={e => setOpen(prevState => !prevState)} style={{cursor: "pointer"}} className={header.data_item}>
            {
                stats.length === 0 && ("0 $")
            }
            {
                stats.length > 0 && (
                    `${stats[0].amount} ${stats[0].currencyCode}`
                )
            }
            {
                stats.length > 1 && isOpen && (
                    <div className={header.data_balance_menu}>
                        {
                            stats.map((e, index) => {
                                if(index !== 0) {
                                    return <div key={e.id} className={header.data_item}>
                                        {e.amount} {e.currencyCode}
                                    </div>;
                                }
                                }
                            )
                        }
                    </div>
                )
            }

        </div>
    );
};