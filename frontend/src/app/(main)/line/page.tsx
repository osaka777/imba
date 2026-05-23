import { Metadata } from "next";

import { AllGamesPrematch } from "~/entities/game";
import { makeMetadata } from "~/shared/lib";

import styles from "./layout.module.css";

export const metadata: Metadata = makeMetadata("Линия");

// Убираем force-dynamic для лучшего кэширования
// export const dynamic = "force-dynamic";

export default function Line() {
  // Убираем серверный запрос, данные будут загружаться на клиенте
  return <AllGamesPrematch className={styles.games} initialData={[]} />;
}
