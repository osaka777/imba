'use client'
import { Dialog, DialogContent, DialogTrigger } from "~/shared/ui";
import { WithdrawForm } from "~/entities/finance/ui/WithdrawForm/WithdrawForm";

import styles from "./Withdraw.module.css";

export const Withdraw = () => {
  return (
    <Dialog>
      <DialogTrigger className={styles.withdrawButton}>
        {`Вывод средств`}
      </DialogTrigger>
      <DialogContent title="Вывод средств">
        <WithdrawForm />
      </DialogContent>
    </Dialog>
  );
};