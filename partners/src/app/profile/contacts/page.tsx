import React from "react";
import styles from "./contacts.module.css"
import { TelegramIcon } from "@/shared/assets";

const Page = () => {
    return (
        <main className={styles.main}>
            <div className={styles.wrapper}>
                <div className={styles.card}>
                    <div className={styles.card_header}>
                        Контакты
                    </div>
                </div>
                <div className={styles.cards_wrapper}>
                    <div className={styles.card}>
                        <div className={styles.card_header}>
                            RevShare
                        </div>
                        <div className={styles.card_contact}>
                            <TelegramIcon />
                            @imbasupport
                        </div>
                    </div>
                    <div className={styles.card}>
                        <div className={styles.card_header}>
                            CPA
                        </div>
                        <div className={styles.card_contact}>
                            <TelegramIcon />
                            @imbasupport
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page;