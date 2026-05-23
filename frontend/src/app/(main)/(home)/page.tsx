import { AllGames } from "~/entities/game";
import styles from "./Home.module.css";

// Убираем force-dynamic для лучшего кэширования
// export const dynamic = "force-dynamic";

export default function Home() {
  // Убираем серверный запрос, данные будут загружаться на клиенте
  return (
    <>
      <AllGames className={styles.games} initialData={[]} />
    </>
  );
}
