"use client";

import { Wallets } from "~/entities/user/ui/Wallets/Wallets";
import { useCurrency } from "~/shared/model/useCurrency";

export function WalletsClient({
  wallets,
}: {
  wallets: {
    currencyCode: string;
    currencyName: string;
    amount: string;
    rawAmount: string;
  }[];
}) {
  const { currency, setCurrency } = useCurrency();

  const balance =
    wallets.find(({ currencyCode }) => currencyCode === currency)?.amount ?? "0";

  return (
    <Wallets
      wallets={wallets}
      balance={balance}
      currency={currency}
      onChangeCurrency={setCurrency}
    />
  );
}
