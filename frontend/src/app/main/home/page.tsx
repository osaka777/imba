import { AllGames } from "~/entities/game";

// Убираем force-dynamic для лучшего кэширования
// export const dynamic = "force-dynamic";

export default function Home() {
  // Убираем серверный запрос, данные будут загружаться на клиенте
  return <AllGames initialData={[]} />;
}
