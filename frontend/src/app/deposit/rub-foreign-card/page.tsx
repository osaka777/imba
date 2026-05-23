"use client";

import { useRouter } from "next-nprogress-bar";
import {
  getMyRubForeignCardOrder,
  uploadRubForeignCardReceipt,
} from "~/entities/finance/api/deposit";
import { ManualForeignCardPage } from "~/entities/finance/ui/ManualForeignCardPage/ManualForeignCardPage";

export default function RubForeignCardPage() {
  const router = useRouter();
  return (
    <ManualForeignCardPage
      currency="RUB"
      fallbackMinAmount={2000}
      getMyOrder={getMyRubForeignCardOrder}
      method="RUB_FOREIGN_CARD"
      onPaymentCancelled={() => router.push("/")}
      title="Пополнение — Перевод в RUB"
      uploadReceipt={uploadRubForeignCardReceipt}
    />
  );
}
