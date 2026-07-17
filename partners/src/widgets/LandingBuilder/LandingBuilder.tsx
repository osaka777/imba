"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createLandingAction } from "@/entities/landing/actions";
import { fetchEventsForPicker } from "@/entities/landing/fetchEvents";
import type { PartnerLandingItem, WcEventPickerItem } from "@/entities/landing/types";
import styles from "./LandingBuilder.module.css";

const TEMPLATES: {
  id: PartnerLandingItem["template"];
  name: string;
  hint: string;
  limit: number;
}[] = [
  {
    id: "HERO_MATCH",
    name: "Герой-матч",
    hint: "1 топ-событие на фиолетовом фоне",
    limit: 1,
  },
  {
    id: "EVENTS_GRID",
    name: "Сетка матчей",
    hint: "До 6 событий из линии или лайва",
    limit: 6,
  },
  {
    id: "PROMO_FOCUS",
    name: "Промо + матчи",
    hint: "Акцент на бонус и до 2 матчей",
    limit: 2,
  },
];

export function LandingBuilder() {
  const router = useRouter();
  const [template, setTemplate] = useState<PartnerLandingItem["template"]>("HERO_MATCH");
  const [title, setTitle] = useState("Мой лендинг");
  const [headline, setHeadline] = useState("Лучшие коэффициенты на imba.bet");
  const [subheadline, setSubheadline] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [mode, setMode] = useState<"line" | "live">("line");
  const [sport, setSport] = useState("soccer");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<WcEventPickerItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = useMemo(
    () => TEMPLATES.find((t) => t.id === template)?.limit ?? 1,
    [template],
  );

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const list = await fetchEventsForPicker({ mode, sport, q: search });
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [mode, sport, search]);

  useEffect(() => {
    const t = setTimeout(loadEvents, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadEvents, search]);

  useEffect(() => {
    setSelected((prev) => prev.slice(0, limit));
  }, [limit]);

  const toggleEvent = (ref: string) => {
    setSelected((prev) => {
      if (prev.includes(ref)) return prev.filter((r) => r !== ref);
      if (prev.length >= limit) {
        if (limit === 1) return [ref];
        return prev;
      }
      return [...prev, ref];
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Выберите хотя бы один матч");
      return;
    }
    setLoading(true);
    try {
      const data = await createLandingAction({
        title,
        template,
        headline: headline || undefined,
        subheadline: subheadline || undefined,
        promoCode: promoCode || undefined,
        eventRefs: selected,
      });
      router.refresh();
      setSelected([]);
      setTitle("Мой лендинг");
      alert(`Лендинг создан: ${data.url}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Конструктор лендинга</h2>
      <p className={styles.desc}>
        Выберите шаблон, добавьте матчи из линии или лайва — получите готовую посадочную на imba.bet
        с вашим тегом и SubID.
      </p>

      <div className={styles.templates}>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.templateBtn} ${template === t.id ? styles.templateActive : ""}`}
            onClick={() => setTemplate(t.id)}
          >
            <span className={styles.templateName}>{t.name}</span>
            <span className={styles.templateHint}>{t.hint}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Название (для себя)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Заголовок на лендинге</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Подзаголовок</span>
            <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Промокод (необязательно)</span>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="WELCOME50"
            />
          </label>
        </div>

        <div className={styles.pickerHeader}>
          <div className={styles.pickerTitle}>Матчи ({selected.length}/{limit})</div>
          <div className={styles.pickerFilters}>
            <select value={mode} onChange={(e) => setMode(e.target.value as "line" | "live")}>
              <option value="line">Линия</option>
              <option value="live">Live</option>
            </select>
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="soccer">Футбол</option>
              <option value="tennis">Теннис</option>
              <option value="basketball">Баскетбол</option>
              <option value="hockey">Хоккей</option>
              <option value="cs2">CS2</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск команды..."
            />
          </div>
        </div>

        <p className={styles.selectedHint}>
          {loadingEvents ? "Загрузка матчей…" : `Найдено: ${events.length}. Кликните, чтобы выбрать.`}
        </p>

        <div className={styles.eventsList}>
          {events.map((ev) => {
            const ref = ev.slug || ev.id;
            const isOn = selected.includes(ref);
            return (
              <button
                key={ev.id}
                type="button"
                className={`${styles.eventRow} ${isOn ? styles.eventSelected : ""}`}
                onClick={() => toggleEvent(ref)}
              >
                <div>
                  <div className={styles.eventTeams}>
                    {ev.homeTeam} — {ev.awayTeam}
                  </div>
                  <div className={styles.eventMeta}>
                    {ev.phase === "live" ? "LIVE · " : ""}
                    {ev.leagueName} ·{" "}
                    {new Date(ev.commenceTime).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span className={styles.eventCheck}>{isOn ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? "Создание…" : "Опубликовать лендинг"}
        </button>
      </form>
    </section>
  );
}
