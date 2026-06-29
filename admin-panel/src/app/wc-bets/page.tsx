"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { RefreshCw, Trophy } from "lucide-react";

import { AuthGuard } from "@/shared/components/AuthGuard";
import { apiCall } from "@/shared/utils/api";
import { Button } from "@/widgets/Button";

type WcBetStatus = "PENDING" | "WIN" | "LOSE" | "VOID";

interface AdminWcBet {
  id: number;
  pick: "HOME" | "DRAW" | "AWAY";
  odds: string;
  stake: string;
  potentialPayout: string;
  status: WcBetStatus;
  currencyCode: string;
  createdAt: string;
  settledAt?: string | null;
  user?: { id: number; email: string | null };
  event: {
    homeTeam: string;
    awayTeam: string;
    commenceTime: string;
    homeScore: number | null;
    awayScore: number | null;
    completed: boolean;
  };
}

const PICK_LABEL: Record<string, string> = {
  HOME: "П1",
  DRAW: "X",
  AWAY: "П2",
};

const STATUS_LABEL: Record<WcBetStatus, string> = {
  PENDING: "Ожидает",
  WIN: "Выигрыш",
  LOSE: "Проигрыш",
  VOID: "Возврат",
};

const baseUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function WcBetsAdminPage() {
  const [items, setItems] = useState<AdminWcBet[]>([]);
  const [status, setStatus] = useState<WcBetStatus | "ALL">("PENDING");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settling, setSettling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = status === "ALL" ? "" : `?status=${status}`;
      const res = await apiCall(`${baseUrl()}/api/feed/admin/bets${q}`);
      if (!res.ok) throw new Error(await res.text());
      setItems(await res.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const syncOdds = async () => {
    setSyncing(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/feed/admin/sync`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Синхронизация: ${data.upserted ?? 0} матчей`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  };

  const settleNow = async () => {
    setSettling(true);
    try {
      const res = await apiCall(`${baseUrl()}/api/feed/admin/settle`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Расчёт: ${data.settledBets ?? 0} ставок, ${data.settledEvents ?? 0} матчей`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка расчёта");
    } finally {
      setSettling(false);
    }
  };

  const stats = useMemo(() => {
    return {
      pending: items.filter((b) => b.status === "PENDING").length,
      win: items.filter((b) => b.status === "WIN").length,
      lose: items.filter((b) => b.status === "LOSE").length,
    };
  }, [items]);

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Trophy className="h-7 w-7 text-yellow-400" />
              Ставки ЧМ (Olimpbet)
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Линия и расчёт через Olimpbet. BetAPI не затрагивается.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={syncOdds} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Синх..." : "Синх. линию"}
            </Button>
            <Button onClick={settleNow} disabled={settling}>
              {settling ? "Расчёт..." : "Рассчитать сейчас"}
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["ALL", "PENDING", "WIN", "LOSE", "VOID"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                status === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {s === "ALL" ? "Все" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-gray-800 p-3">Ожидают: {stats.pending}</div>
          <div className="rounded-lg bg-gray-800 p-3 text-green-400">Выигрыши: {stats.win}</div>
          <div className="rounded-lg bg-gray-800 p-3 text-red-400">Проигрыши: {stats.lose}</div>
        </div>

        {loading && <p className="text-gray-400">Загрузка...</p>}

        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Пользователь</th>
                <th className="px-3 py-2 text-left">Матч</th>
                <th className="px-3 py-2 text-left">Исход</th>
                <th className="px-3 py-2 text-left">Сумма</th>
                <th className="px-3 py-2 text-left">Кф</th>
                <th className="px-3 py-2 text-left">Выплата</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left">Счёт</th>
                <th className="px-3 py-2 text-left">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {items.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2">{b.id}</td>
                  <td className="px-3 py-2">
                    #{b.user?.id} {b.user?.email || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {b.event.homeTeam} — {b.event.awayTeam}
                  </td>
                  <td className="px-3 py-2">{PICK_LABEL[b.pick]}</td>
                  <td className="px-3 py-2">
                    {Number(b.stake).toFixed(0)} {b.currencyCode}
                  </td>
                  <td className="px-3 py-2">{Number(b.odds).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {Number(b.potentialPayout).toFixed(0)} {b.currencyCode}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        b.status === "WIN"
                          ? "text-green-400"
                          : b.status === "LOSE"
                            ? "text-red-400"
                            : b.status === "PENDING"
                              ? "text-yellow-300"
                              : "text-gray-300"
                      }
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {b.event.homeScore != null && b.event.awayScore != null
                      ? `${b.event.homeScore}:${b.event.awayScore}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(b.createdAt).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    Ставок нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
}
