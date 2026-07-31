"use client";

import { useEffect, useState } from "react";
import { WithdrawForm } from "~/entities/finance/ui/WithdrawForm/WithdrawForm";
import withdrawFormStyles from "~/entities/finance/ui/WithdrawForm/WithdrawForm.module.css";
import { useLocale } from "~/shared/model/useLocale";
import { Dialog, DialogContent } from "~/shared/ui";

type Props = {
  onClose: () => void;
};

export const WithdrawModal = ({ onClose }: Props) => {
  const { t } = useLocale();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <DialogContent
        className={withdrawFormStyles.withdrawDialog}
        title={t("deposit.withdraw")}
        onClick={(e) => e.stopPropagation()}
      >
        <WithdrawForm />
      </DialogContent>
    </Dialog>
  );
};
