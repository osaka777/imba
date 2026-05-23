import React from "react";
import styles from "./withdrawal.module.css"
import { LogoIcon } from "@/shared/assets";
import { SadSmile } from "@/shared/assets/icons";
import { WithdrawalCard } from "@/widgets/WithdrawalCard/WithdrawalCard";
import { PaymentTable } from "@/widgets/PaymentTable/PaymentTable";
import { PaymentInfo } from "@/widgets/PaymentInfo/PaymentInfo";

const Page = () => {
    return (
        <main className={styles.main}>
            <div className={styles.wrapper}>
                <div className={styles.payment_actions}>
                    <WithdrawalCard />
                    <PaymentInfo />
                </div>
                <PaymentTable />
            </div>
        </main>
    );
};

export default Page;