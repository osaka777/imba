"use client";

import { Dialog, DialogContent, DialogTrigger } from "~/shared/ui";
import { WithdrawForm } from "~/entities/finance/ui/WithdrawForm/WithdrawForm";
import withdrawFormStyles from "~/entities/finance/ui/WithdrawForm/WithdrawForm.module.css";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./Withdraw.module.css";

export const Withdraw = () => {
  const { t } = useLocale();

  return (
    <Dialog>
      <DialogTrigger className={styles.withdrawButton}>
        {t("deposit.withdraw")}
      </DialogTrigger>
      <DialogContent className={withdrawFormStyles.withdrawDialog} title={t("deposit.withdraw")}>
        <WithdrawForm />
      </DialogContent>
    </Dialog>
  );
};
