import React from "react";
import styles from "./withdrawal.module.css";
import { WithdrawalCard } from "@/widgets/WithdrawalCard/WithdrawalCard";
import { PaymentTable } from "@/widgets/PaymentTable/PaymentTable";
import { PaymentInfo } from "@/widgets/PaymentInfo/PaymentInfo";
import shell from "../profile-shell.module.css";

const Page = () => {
  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Выводы</h1>
        <p className={shell.pageSubtitle}>
          Запрос выплаты на USDT TRC-20 и история операций
        </p>
      </header>
      <div className={styles.layout}>
        <div className={styles.payment_actions}>
          <WithdrawalCard />
          <PaymentInfo />
        </div>
        <PaymentTable />
      </div>
    </>
  );
};

export default Page;
