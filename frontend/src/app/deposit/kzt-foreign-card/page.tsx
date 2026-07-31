"use client";

import { useRouter } from "next-nprogress-bar";
import {
  getMyKztForeignCardOrder,
  uploadKztForeignCardReceipt,
} from "~/entities/finance/api/deposit";
import { useLocale } from "~/shared/model/useLocale";
import { ManualForeignCardPage } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardPage";

export default function KztForeignCardPage() {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <ManualForeignCardPage
      currency="KZT"
      fallbackMinAmount={3000}
      getMyOrder={getMyKztForeignCardOrder}
      method="KZT_FOREIGN_CARD"
      onPaymentCancelled={() => router.push("/")}
      title={t("common.seoDepositKzt")}
      uploadReceipt={uploadKztForeignCardReceipt}
    />
  );
}
