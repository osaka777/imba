import { GamesBySport } from "~/entities/game";

// Убираем force-dynamic для лучшего кэширования
// export const dynamic = "force-dynamic";

export default async function Sport({ params }: { params: { sport: string } }) {
  const paramsObj = await params;
  
  // Убираем серверный запрос, данные будут загружаться на клиенте
  return (
    <GamesBySport
      className="[grid-area:table]"
      sport={paramsObj.sport}
    />
  );
}
