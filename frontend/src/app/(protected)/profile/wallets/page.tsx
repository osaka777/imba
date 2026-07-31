"use client";

import { useEffect, useState } from "react";
import { getSessionClient } from "~/entities/user/lib";
import { api, components } from "~/shared/api";
import { WalletsClient } from "~/entities/user/ui/Wallets/WalletsClient";
import { languageService } from "~/shared/services/language.service";
import { useLocale } from "~/shared/model/useLocale";

type Currency = components["schemas"]["CurrencyDto"];
type Balance = components["schemas"]["BalanceDto"];

type Wallet = {
  currencyCode: string;
  currencyName: string;
  amount: string;
  rawAmount: string;
};

export default function WalletsPage() {
  const { t } = useLocale();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const token = getSessionClient();
        if (!token) {
          setError(t("profile.authRequiredWallets"));
          setIsLoading(false);
          return;
        }

        const [currenciesResponse, balancesResponse] = await Promise.all([
          api.GET("/api/currencies", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.GET("/api/finance/balance", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (currenciesResponse.error) {
          console.error("Error fetching currencies:", currenciesResponse.error);
          setError(
            t("profile.currenciesLoadError", {
              message:
                (currenciesResponse.error as { message?: string })?.message
                || t("profile.unknownError"),
            }),
          );
          return;
        }

        if (balancesResponse.error) {
          console.error("Error fetching balances:", balancesResponse.error);
          setError(
            t("profile.balancesLoadError", {
              message:
                (balancesResponse.error as { message?: string })?.message
                || t("profile.unknownError"),
            }),
          );
          return;
        }

        const currencies = currenciesResponse.data as Currency[];
        const balances = balancesResponse.data as Balance[];

        const walletsData =
          currencies?.map((currency: Currency) => {
            const found = balances?.find(
              (b: Balance) => b.currencyCode === currency.isoCode,
            );
            const amount = found?.amount || "0";
            const formattedAmount = languageService
              .getNumberFormat()
              .format(Number(amount));
            return {
              currencyCode: currency.isoCode.trim(),
              currencyName: currency.name,
              amount: formattedAmount,
              rawAmount: amount,
            };
          }) || [];

        setWallets(walletsData);
      } catch (err) {
        console.error("Unexpected error in WalletsPage:", err);
        setError(t("profile.walletsUnexpected"));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchWallets();
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t("profile.walletsLoading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <h3 className="text-lg text-red-600">{error}</h3>
      </div>
    );
  }

  return <WalletsClient wallets={wallets} />;
}
