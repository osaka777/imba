import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { components } from "~/shared/api";
import { cn } from "~/shared/lib";
import { TeamImage } from "~/components/ui/TeamImage";
import styles from "./ScoreBoard.module.css";
import { gamesList } from "../../lib";

type GameStatus = "PREMATCH" | "IN_PROGRESS" | "FINISHED" | "CANCELED" | "STARTING";
type Sport = keyof typeof PERIOD_NAMES;

interface StatListItem {
  id: string | number;
  opp1: string;
  opp2: string;
  name: string;
  home?: string;
  away?: string;
  value1?: string;
  value2?: string;
  title?: string;
  label?: string;
}

interface GameMeta {
  raw_start_at?: string;
  opp_1_icon?: string | null;
  opp_2_icon?: string | null;
  stat_list?: StatListItem[];
}

interface GameScore {
  text?: {
    time?: string;
    liveScore?: string;
    currentScore?: string;
  };
  seconds?: number;
  period?: string | number;
  details?: [number | string, number | string][];
  currentScore?: (number | string)[];
  liveScore?: {
    active?: number;
  };
}

const PERIOD_NAMES: Record<string, string> = {
  basketball: "Четверть",
  hockey: "Период",
  soccer: "Тайм",
  "table-tennis": "Сет",
  tennis: "Сет",
  volleyball: "Сет"
};

const translateSport = (sport?: string): string => {
  if (!sport) return "";
  return gamesList[sport]?.label ?? sport;
};

const translateInfoName = (sport: string): string => {
  return PERIOD_NAMES[sport] ?? "Период";
};

type ScoreProps = {
  game: components["schemas"]["GameDtoWithGroupedMarkets"] & {
    status: GameStatus;
    sport: Sport;
    meta?: GameMeta;
    parsedScore?: GameScore;
    team1: string;
    team2: string;
    eventName: string;
    leagueName: string;
  };
  hasSubGames?: boolean;
};

const timeToSeconds = (timeStr: string | undefined): number => {
  if (!timeStr) return 0;
  const [min, sec] = timeStr.split(":").map(Number);
  return (min || 0) * 60 + (sec || 0);
};

const secondsToTime = (totalSeconds: number): string => {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const PrematchView = ({ game }: ScoreProps) => (
  <div
    className="grid gap-6 px-1 py-3 mb-4 rounded-lg"
    style={{
      background: `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%), url(/${game.sport}.jpg) center / cover`,
      height: "320px",
    }}
  >
    <div className="grid items-center grid-cols-3 text-center rounded-sm justify-items-center bg-white/5">
      <div>{translateSport(game.sport)}</div>
      <div style={{ width: "100px" }}>
        {game.meta?.raw_start_at && `Начнётся: ${game.meta.raw_start_at}`}
        <br />
        {game.eventName}
      </div>
      <div>{game.leagueName}</div>
    </div>
  </div>
);

const TeamScore = ({ 
  name, 
  icon, 
  isActive, 
  align = "right" 
}: { 
  name: string; 
  icon: string | null; 
  isActive?: boolean;
  align?: "left" | "right";
}) => (
  <div className={`flex items-center gap-2 font-medium text-md ${align === "right" ? "justify-end" : ""}`}>
    {align === "right" && (
      <span className="flex items-center gap-2">
        {isActive && <div className="bg-green-400 rounded-full w-2 h-2" />}
        {name}
      </span>
    )}
    <TeamImage src={icon} alt={name} size={64} />
    {align === "left" && (
      <span className="flex items-center gap-2">
        {name}
        {isActive && <div className="bg-green-400 rounded-full w-2 h-2" />}
      </span>
    )}
  </div>
);

interface ValueChangeProps {
  value: string | number;
  className?: string;
}

const ValueChange = ({ value, className }: ValueChangeProps) => {
  const [prevValue, setPrevValue] = useState(value);
  const [changeType, setChangeType] = useState<'increased' | 'decreased' | null>(null);

  useEffect(() => {
    if (value !== prevValue) {
      if (Number(value) > Number(prevValue)) {
        setChangeType('increased');
      } else if (Number(value) < Number(prevValue)) {
        setChangeType('decreased');
      }
      setPrevValue(value);

      const timer = setTimeout(() => {
        setChangeType(null);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  return (
    <span className={cn(
      className,
      changeType === 'increased' && styles['value-increased'],
      changeType === 'decreased' && styles['value-decreased']
    )}>
      {value}
    </span>
  );
};

const ScoreboardRow = ({ 
  playerName, 
  currentScore, 
  scores, 
  type 
}: { 
  playerName: string;
  currentScore: string | number;
  scores: (string | number)[];
  type: "first" | "second";
}) => (
  <div className={styles.scoreboardRow}>
    <div className={cn(styles.scoreboardCell, styles.playerName)}>
      {playerName}
    </div>
    <ValueChange 
      value={currentScore ?? "-"}
      className={type === "first" ? styles.fisrtScorePlayer : styles.secondScorePlayer}
    />
    {scores.map((s: string | number, idx: number) => (
      <ValueChange
        key={idx}
        value={s}
        className={cn(
          styles.scoreboardCell,
          styles.primaryScore,
          type === "first" ? styles.fisrtScorePlayer : styles.secondScorePlayer
        )}
      />
    ))}
  </div>
);

const ModeToggle = ({ 
  viewMode, 
  onModeChange, 
  hasStats 
}: { 
  viewMode: 'teams' | 'stats';
  onModeChange: (mode: 'teams' | 'stats') => void;
  hasStats: boolean;
}) => {
  if (!hasStats) return null;
  
  return (
    <div className="flex bg-white/10 rounded-lg p-1 mb-4">
      <button
        onClick={() => onModeChange('teams')}
        className={cn(
          "px-4 py-2 rounded-md text-sm font-medium transition-all",
          viewMode === 'teams'
            ? "bg-blue-500 text-white shadow-md"
            : "text-white/70 hover:text-white hover:bg-white/5"
        )}
      >
        Команды
      </button>
      <button
        onClick={() => onModeChange('stats')}
        className={cn(
          "px-4 py-2 rounded-md text-sm font-medium transition-all",
          viewMode === 'stats'
            ? "bg-blue-500 text-white shadow-md"
            : "text-white/70 hover:text-white hover:bg-white/5"
        )}
      >
        Статистика
      </button>
    </div>
  );
};

export const ScoreBoard = ({ game, hasSubGames = false }: ScoreProps) => {
  const score = game.parsedScore;
  
  const [displayedTime, setDisplayedTime] = useState<string>("00:00");
  const [viewMode, setViewMode] = useState<'teams' | 'stats'>('teams');
  const lastUpdateTimeRef = useRef(Date.now());
  const lastServerSecondsRef = useRef(timeToSeconds(score?.text?.time));

  const shouldRunTimer = useMemo(() => (
    game.status === "IN_PROGRESS" &&
    (score?.seconds ?? 0) > 0 &&
    (score?.text?.time ?? "") !== "00:00"
  ), [game.status, score?.seconds, score?.text?.time]);

  useEffect(() => {
    const serverSeconds = timeToSeconds(score?.text?.time);
    lastServerSecondsRef.current = serverSeconds;
    lastUpdateTimeRef.current = Date.now();
    setDisplayedTime(score?.text?.time || "00:00");
  }, [score?.text?.time]);

  useEffect(() => {
    if (!shouldRunTimer) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastUpdateTimeRef.current) / 1000);
      const fakeTime = lastServerSecondsRef.current + elapsed;
      setDisplayedTime(secondsToTime(fakeTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [shouldRunTimer]);

  if (game.status === "PREMATCH") {
    return <PrematchView game={game} />;
  }

  const firstPlayerScores = score?.details?.map(([f]: [number | string, number | string]) => f) ?? [];
  const secondPlayerScores = score?.details?.map(([_f, s]: [number | string, number | string]) => s) ?? [];
  const periodName = translateInfoName(game.sport);
  const currentScoreForEachPlayer = score?.currentScore ?? [];
  
  const mainScore = useMemo(() => {
    if (game.sport === "tennis") {
      return score?.text?.liveScore || "-:-";
    }
    return score?.text?.currentScore || "-:-";
  }, [game.sport, score?.text?.liveScore, score?.text?.currentScore]);

  const gameStatus = useMemo(() => {
    switch (game.status) {
      case "FINISHED": 
        // Для завершенных игр всегда показываем "Окончена", независимо от наличия подыгр
        return "Окончена";
      case "CANCELED": return "Отменена";
      case "IN_PROGRESS": return `${score?.period ?? "1"} ${periodName}`;
      case "STARTING": return "Скоро начнётся";
      default: return "";
    }
  }, [game.status, score?.period, periodName]);

  const hasStats = useMemo(() => {
    return (game.meta?.stat_list?.length ?? 0) > 0;
  }, [game.meta?.stat_list?.length]);

  
  const hasDetails = useMemo(() => (score?.details?.length ?? 0) > 0, [score?.details?.length]);
  return (
    <div
      className="grid gap-6 px-1 py-3 mb-4 rounded-lg"
      style={{
        background: `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%), url(/${game.sport}.jpg) center / cover`,
      }}
    >
      <div className="grid items-center grid-cols-3 text-center rounded-sm justify-items-center bg-white/5">
        <div>{translateSport(game.sport)}</div>
        {game.sport !== "tennis" && <ValueChange value={displayedTime} />}
        {game.sport === "tennis" && <div></div>}
        <div>{game.leagueName}</div>
      </div>

      <div className="w-full flex justify-center items-center">
        <div className="w-full max-w-4xl">
          <div className={cn(
            "grid",
            "grid-cols-1",
            "items-center justify-items-center rounded-sm text-center gap-4"
          )}>
            <div className={cn(
              "flex flex-col items-center justify-center",
              "col-span-1",
              "w-full"
            )}>
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center w-full max-w-2xl">
                  <TeamScore 
                    name={game.team1}
                    icon={game.meta?.opp_1_icon || null}
                    isActive={score?.liveScore?.active === 1}
                    align="right"
                  />

                  <div className={styles.game__info}>
                    <div className={styles.game__heading}>{gameStatus}</div>
                    <ValueChange value={mainScore} className={styles.game__score} />
                  </div>

                  <TeamScore 
                    name={game.team2}
                    icon={game.meta?.opp_2_icon || null}
                    isActive={score?.liveScore?.active === 2}
                    align="left"
                  />
                </div>

                <ModeToggle 
                  viewMode={viewMode}
                  onModeChange={setViewMode}
                  hasStats={hasStats}
                />

                {viewMode === 'teams' && hasDetails && (
                  <div className="w-full max-w-3xl mx-auto">
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
                      {/* Заголовок таблицы команд */}
                      <div className="bg-white/5 px-4 py-3 border-b border-white/10">
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center text-sm font-medium text-white/70">
                          <div className="text-left">Команда</div>
                          <div className="text-center">Общий счёт</div>
                          <div className="text-right">По периодам</div>
                        </div>
                      </div>
                      
                      {/* Строки команд */}
                      <div className="divide-y divide-white/5">
                        {/* Первая команда */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-4 py-3 hover:bg-white/5 transition-colors">
                          <div className="text-left">
                            <span className="text-white/90 font-medium">{game.team1}</span>
                          </div>
                          <div className="text-center">
                            <div className="bg-white/10 px-3 py-1 rounded border border-white/20">
                              <span className="text-white font-semibold">{currentScoreForEachPlayer[0] ?? "-"}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-2 justify-end">
                              {firstPlayerScores.map((score: string | number, idx: number) => (
                                  <div key={idx} className="bg-white/5 px-2 py-1 rounded text-xs border border-white/10">
                                  <span className="text-white/80">{score}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Вторая команда */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-4 py-3 hover:bg-white/5 transition-colors">
                          <div className="text-left">
                            <span className="text-white/90 font-medium">{game.team2}</span>
                          </div>
                          <div className="text-center">
                            <div className="bg-white/10 px-3 py-1 rounded border border-white/20">
                              <span className="text-white font-semibold">{currentScoreForEachPlayer[1] ?? "-"}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-2 justify-end">
                              {secondPlayerScores.map((score: string | number, idx: number) => (
                                <div key={idx} className="bg-white/5 px-2 py-1 rounded text-xs border border-white/10">
                                  <span className="text-white/80">{score}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {viewMode === 'stats' && hasStats && (
                  <div className="w-full max-w-3xl mx-auto">
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
                      {/* Заголовок таблицы статистики */}
                      <div className="bg-white/5 px-4 py-3 border-b border-white/10">
                        <div className="grid grid-cols-3 items-center">
                          <div className="text-left">
                            <span className="font-medium text-white/90 truncate">{game.team1}</span>
                          </div>
                          <div className="text-center">
                            <span className="font-medium text-white/70 text-sm">Статистика</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-white/90 truncate">{game.team2}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Строки статистики */}
                      <div className="divide-y divide-white/5">
                        {game.meta?.stat_list?.map((row, index) => {
                          // Обработка различных форматов статистики
                          const team1Value = row.opp1 || row.home || row.value1 || "-";
                          const team2Value = row.opp2 || row.away || row.value2 || "-";
                          const statName = row.name || row.title || row.label || `Показатель ${index + 1}`;
                          
                          return (
                            <div 
                              key={row.id || `stat-${index}`} 
                              className="grid grid-cols-3 items-center px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              {/* Значение первой команды */}
                              <div className="text-left">
                                <div className="bg-white/10 px-3 py-1 rounded border border-white/20 inline-block">
                                  <span className="font-semibold text-white/90">
                                    {team1Value}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Название статистики */}
                              <div className="text-center px-2">
                                <span className="text-white/70 text-xs font-medium">
                                  {statName}
                                </span>
                              </div>
                              
                              {/* Значение второй команды */}
                              <div className="text-right">
                                <div className="bg-white/10 px-3 py-1 rounded border border-white/20 inline-block">
                                  <span className="font-semibold text-white/90">
                                    {team2Value}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
