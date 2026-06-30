"use client";

import { useEffect, useState } from "react";
import styles from "./PartnerStatusBanner.module.css";

type AccountStatus = {
  status: "PENDING" | "ACTIVE" | "BLOCKED";
};

export const PartnerStatusBanner = () => {
  const [status, setStatus] = useState<AccountStatus["status"] | null>(null);

  useEffect(() => {
    fetch("/api/account-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setStatus(data.status))
      .catch(() => null);
  }, []);

  if (!status || status === "ACTIVE") return null;

  const message =
    status === "PENDING"
      ? "Аккаунт на модерации. Вывод средств будет доступен после активации менеджером."
      : "Аккаунт заблокирован. Обратитесь в поддержку.";

  return (
    <div className={`${styles.banner} ${styles[status.toLowerCase()]}`}>
      {message}
    </div>
  );
};
