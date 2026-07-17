"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type ModalCloseProps = { onClose: () => void };

export const LazyVoucherModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/VoucherModal").then((m) => m.VoucherModal),
  { ssr: false },
);

export const LazyWithdrawModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/WithdrawModal").then((m) => m.WithdrawModal),
  { ssr: false },
);

export const LazySettingsModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/SettingsModal").then((m) => m.SettingsModal),
  { ssr: false },
);

export const LazyBetsHistoryModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/BetsHistoryModal").then((m) => m.BetsHistoryModal),
  { ssr: false },
);

export const LazyBonusHistoryModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/BonusHistoryModal").then((m) => m.BonusHistoryModal),
  { ssr: false },
);

export const LazyDetailsModal = dynamic<ModalCloseProps>(
  () => import("~/shared/ui/modals/DetailsModal").then((m) => m.DetailsModal),
  { ssr: false },
);

export const LazyDepositForm = dynamic(
  () => import("~/entities/finance").then((m) => m.DepositForm),
  { ssr: false },
);

export const LazyLuckyDriveModal = dynamic(
  () =>
    import("~/entities/game/ui/LuckyDrive/LuckyDriveModal").then(
      (m) => m.LuckyDriveModal,
    ),
  { ssr: false },
);

export const LazyUsdtPromoModal = dynamic(
  () =>
    import("~/entities/game/ui/LuckyDrive/UsdtPromoModal").then(
      (m) => m.UsdtPromoModal,
    ),
  { ssr: false },
);

export const LazyWelcomeBonusModal = dynamic(
  () =>
    import("~/entities/game/ui/LuckyDrive/WelcomeBonusModal").then(
      (m) => m.WelcomeBonusModal,
    ),
  { ssr: false },
);

export const LazyCouponSidebar = dynamic(
  () =>
    import("~/entities/bet/ui/Coupon/CouponWrapper").then(
      (m) => m.CouponWrapper,
    ),
  { ssr: false },
) as React.ComponentType<{ className?: string }>;

export const MODAL_BY_ID: Record<string, ComponentType<ModalCloseProps>> = {
  voucher: LazyVoucherModal,
  withdraw: LazyWithdrawModal,
  settings: LazySettingsModal,
  history: LazyBetsHistoryModal,
  "bonus-history": LazyBonusHistoryModal,
  details: LazyDetailsModal,
};
