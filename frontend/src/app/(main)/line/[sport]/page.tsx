import { GamesBySportPrematch } from "~/entities/game/ui/GamesPrematch";
import { makeMetadata } from "~/shared/lib";

// Убираем force-dynamic для лучшего кэширования
// export const dynamic = "force-dynamic";

export const metadata = makeMetadata("Линия");

export default async function Sport({ params }: { params: { sport: string } }) {
  const paramsObj = await params;
  
  // Убираем серверный запрос, данные будут загружаться на клиенте
  return (
    <GamesBySportPrematch
      className="[grid-area:table]"
      sport={paramsObj.sport}
    />
  );
}
