'use client'
import { Dialog, DialogContent, DialogTrigger } from "~/shared/ui";
import { WithdrawForm } from "~/entities/finance/ui/WithdrawForm/WithdrawForm";
import withdrawFormStyles from "~/entities/finance/ui/WithdrawForm/WithdrawForm.module.css";

import styles from "./Withdraw.module.css";

export const Withdraw = () => {
  return (
    <Dialog>
      <DialogTrigger className={styles.withdrawButton}>
        {`Вывод средств`}
      </DialogTrigger>
      <DialogContent className={withdrawFormStyles.withdrawDialog} title="Вывод средств">
        <WithdrawForm />
      </DialogContent>
    </Dialog>
  );
};