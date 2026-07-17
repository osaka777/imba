"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "~/app/providers/AuthProvider";
import {
  LazyDepositForm,
  LazyVoucherModal,
  LazyWithdrawModal,
} from "~/shared/lib/lazyModals";
import {
  mobileRouteForSupportAction,
  type SupportSiteAction,
} from "~/shared/lib/supportSiteActions";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";

import depositStyles from "~/widgets/Navigation/Deposit.module.css";

export function SupportChatModalHost() {
  const router = useRouter();
  const { isAuth } = useAuth();
  const { armGuard, blockIfArmed } = useDialogOutsideGuard();
  const [depositOpen, setDepositOpen] = useState(false);
  const [overlayModal, setOverlayModal] = useState<SupportSiteAction | null>(null);

  const openDeposit = useCallback(() => {
    armGuard();
    scheduleDialogOpen(setDepositOpen);
  }, [armGuard]);

  const closeOverlay = useCallback(() => {
    setOverlayModal(null);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: SupportSiteAction }>).detail;
      const action = detail?.action;
      if (!action || !isAuth) return;

      if (window.matchMedia("(min-width: 769px)").matches) {
        if (action === "deposit") {
          openDeposit();
          return;
        }
        setOverlayModal(action);
        return;
      }

      router.push(mobileRouteForSupportAction(action));
    };

    window.addEventListener("imba:support-site-action", handler);
    return () => window.removeEventListener("imba:support-site-action", handler);
  }, [isAuth, openDeposit, router]);

  const renderOverlay = () => {
    if (!overlayModal) return null;
    if (overlayModal === "withdraw") {
      return <LazyWithdrawModal onClose={closeOverlay} />;
    }
    if (overlayModal === "voucher") {
      return <LazyVoucherModal onClose={closeOverlay} />;
    }
    return null;
  };

  return (
    <>
      {overlayModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={closeOverlay}
        >
          {renderOverlay()}
        </div>
      ) : null}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent
          className={depositStyles.dialog}
          title="Пополнение счета"
          onInteractOutside={blockIfArmed}
          onPointerDownOutside={blockIfArmed}
        >
          {depositOpen ? <LazyDepositForm /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
