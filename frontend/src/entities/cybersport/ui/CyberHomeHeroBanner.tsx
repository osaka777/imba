"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import type { CyberGame } from "~/entities/cybersport/api/client";
import {
  useHomeHeroFeatured,
  type HomeHeroSlide,
} from "~/entities/cybersport/hooks/useHomeHeroFeatured";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";
import {
  cyberGameToHomeWcEvent,
  readCyberWcMeta,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { resolveCyberSportLabel } from "~/entities/cybersport/lib/cyberSportsList";
import { CyberStreamPlaceholder } from "~/entities/cybersport/ui/CyberStreamPlaceholder";
import { getSportLabel } from "~/entities/game/lib/gamesList";
import type { WcEvent } from "~/entities/wc-odds/api/client";
import {
  formatWcCompactOdd,
  formatWcCompactTime,
} from "~/entities/wc-odds/lib/wcCompactFormat";
import {
  formatWcListLiveScore,
  formatWcRowLiveTime,
} from "~/entities/wc-odds/lib/wcLiveScore";
import {
  buildWcRate,
  isWcOddsRate,
  WC_MARKET,
  WC_PICK_LABEL,
  type WcPick,
} from "~/entities/wc-odds/lib/wcRate";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CyberHomeHeroBanner.module.css";

function seriesScores(game: CyberGame): [number | null, number | null] {
  const details = game.parsedScore?.details;
  if (Array.isArray(details) && details.length > 0) {
    let h = 0;
    let a = 0;
    for (const row of details) {
      const x = Number(row?.[0]) || 0;
      const y = Number(row?.[1]) || 0;
      if (x === y) continue;
      if (x >= 13 || y >= 13 || Math.abs(x - y) >= 2) {
        if (x > y) h += 1;
        else a += 1;
      } else if (x > y) h += 1;
      else a += 1;
    }
    return [h, a];
  }
  return [null, null];
}

function mapLabel(game: CyberGame): string | null {
  const details = game.parsedScore?.details;
  if (!Array.isArray(details) || details.length === 0) return null;
  const finished = details.filter((row) => {
    const x = Number(row?.[0]) || 0;
    const y = Number(row?.[1]) || 0;
    return x !== y;
  }).length;
  const current = Math.min(finished + 1, Math.max(details.length, finished + 1));
  const bestOf = Math.max(3, current % 2 === 0 ? current + 1 : current);
  return `Map ${current} of ${bestOf}`;
}

function isLiveStatus(game: CyberGame): boolean {
  return (
    game.status === "IN_PROGRESS" ||
    game.status === "LIVE" ||
    game.status === "IN_PLAY" ||
    game.status === "STARTING"
  );
}

function impliedCents(
  home: number | null,
  away: number | null,
): [number, number] {
  const h = home != null && home > 1 ? 1 / home : 0.5;
  const a = away != null && away > 1 ? 1 / away : 0.5;
  const sum = h + a || 1;
  const hc = Math.round((100 * h) / sum);
  return [hc, Math.max(0, 100 - hc)];
}

type BarPulse = "up" | "down" | null;

function OddsChanceBar({
  cents,
  odd,
  tone,
}: {
  cents: number;
  odd: number | null;
  tone: "home" | "away";
}) {
  const [pulse, setPulse] = useState<BarPulse>(null);
  const prevOddRef = useRef<number | null>(null);
  const width = Math.max(cents, 4);

  useEffect(() => {
    const prev = prevOddRef.current;
    prevOddRef.current = odd;
    if (prev == null || odd == null || !Number.isFinite(odd) || !Number.isFinite(prev)) {
      return;
    }
    if (Math.abs(odd - prev) < 0.001) return;
    setPulse(odd > prev ? "up" : "down");
    const t = window.setTimeout(() => setPulse(null), 720);
    return () => window.clearTimeout(t);
  }, [odd]);

  return (
    <div className={styles.barTrack}>
      <div
        className={[
          styles.barFill,
          tone === "home" ? styles.barFillHome : styles.barFillAway,
          pulse === "up" ? styles.barFillPulseUp : "",
          pulse === "down" ? styles.barFillPulseDown : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** Stable hero odds CTA — no flash animations / filter hover (those caused twitch). */
function HeroCta({
  event,
  pick,
  odd,
  tone,
}: {
  event: WcEvent;
  pick: WcPick;
  odd: number | null;
  tone: "home" | "away";
}) {
  const bettingOpen = useWcBettingOpen(event);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });
  const market = WC_MARKET[pick];
  const value = formatWcCompactOdd(odd, "—");
  const available =
    bettingOpen && odd != null && Number.isFinite(odd) && odd > 1 && value !== "—";
  const added = rates.some(
    (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
  );

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!available || odd == null) return;
    setRates((prev) => {
      const existing = prev.find(
        (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
      );
      if (existing) {
        return prev.filter(
          (r) => !(isWcOddsRate(r) && r.eventId === event.id && r.market === market),
        );
      }
      return [
        ...prev.filter((r) => !(isWcOddsRate(r) && r.eventId === event.id)),
        buildWcRate(event, pick, odd),
      ];
    });
    window.dispatchEvent(new CustomEvent("open-coupon"));
  };

  const toneClass = tone === "home" ? styles.ctaHome : styles.ctaAway;

  if (!available) {
    return (
      <span className={`${styles.cta} ${styles.ctaDisabled}`}>
        <span className={styles.ctaPick}>{WC_PICK_LABEL[pick]}</span>
        <span className={styles.ctaCoef}>—</span>
      </span>
    );
  }

  return (
    <button
      aria-label={`${WC_PICK_LABEL[pick]} ${value}`}
      aria-pressed={added}
      className={`${styles.cta} ${toneClass} ${added ? styles.ctaAdded : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className={styles.ctaPick}>{WC_PICK_LABEL[pick]}</span>
      <span className={styles.ctaCoef}>{value}</span>
    </button>
  );
}

function HeroNav({
  multi,
  onPrev,
  onNext,
}: {
  multi: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!multi) return null;
  return (
    <>
      <button
        aria-label="prev"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPrev();
        }}
        type="button"
      >
        ‹
      </button>
      <button
        aria-label="next"
        className={`${styles.arrow} ${styles.arrowRight}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onNext();
        }}
        type="button"
      >
        ›
      </button>
    </>
  );
}

function WcTeamsPlaceholder({
  homeTeam,
  awayTeam,
  homeIcon,
  awayIcon,
  scoreText,
  live,
}: {
  homeTeam: string;
  awayTeam: string;
  homeIcon?: null | string;
  awayIcon?: null | string;
  scoreText: string;
  live: boolean;
}) {
  return (
    <div className={styles.wcPlaceholder}>
      <div className={styles.wcPlaceholderSide}>
        <WcTeamImage iconUrl={homeIcon} size={56} teamName={homeTeam} />
        <span className={styles.wcPlaceholderName}>{homeTeam}</span>
      </div>
      <div className={styles.wcPlaceholderMid}>
        {live ? <span className={styles.wcPlaceholderLive}>LIVE</span> : null}
        <span className={styles.wcPlaceholderScore}>{scoreText}</span>
      </div>
      <div className={styles.wcPlaceholderSide}>
        <WcTeamImage iconUrl={awayIcon} size={56} teamName={awayTeam} />
        <span className={styles.wcPlaceholderName}>{awayTeam}</span>
      </div>
    </div>
  );
}

function CyberHeroSlide({
  game,
  multi,
  onPrev,
  onNext,
}: {
  game: CyberGame;
  multi: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useLocale();
  const meta = readCyberWcMeta(game);
  const wcRef = meta.wcEventRef ?? game.eventId;
  const hasVideo = cyberGameHasVideo(game);
  const live = isLiveStatus(game);
  const team1 = maskCybersportLabel(game.team1);
  const team2 = maskCybersportLabel(game.team2);
  const league = maskCybersportLabel(game.leagueName);
  const wcEvent = useMemo(() => cyberGameToHomeWcEvent(game), [game]);
  const homeOddNum = wcEvent.oddsHome;
  const awayOddNum = wcEvent.oddsAway;
  const homeOdd = formatWcCompactOdd(homeOddNum, "—");
  const awayOdd = formatWcCompactOdd(awayOddNum, "—");
  const [centsHome, centsAway] = impliedCents(homeOddNum, awayOddNum);
  const [scoreHome, scoreAway] = seriesScores(game);
  const mapText = mapLabel(game);
  const sportLabel = resolveCyberSportLabel(game.sport || "") || "Esports";
  const href = `/cybersport/game/${game.eventId}`;

  const broadcastMeta = {
    homeTeam: game.team1 ?? "",
    awayTeam: game.team2 ?? "",
    leagueName: game.leagueName ?? "",
    homeTeamIcon: game.team1Icon ?? null,
    awayTeamIcon: game.team2Icon ?? null,
  };

  return (
    <section className={styles.card}>
      <div className={styles.media}>
        <Link
          aria-label={`${team1} vs ${team2}`}
          className={styles.hit}
          href={href}
          tabIndex={-1}
        />
        {hasVideo && wcRef ? (
          <div className={styles.playerShell}>
            <WcBroadcastPlayer
              autoPlayWithSound
              eventRef={wcRef}
              hasBroadcast
              hideChrome
              meta={broadcastMeta}
              showFullscreen={false}
              sport={game.sport}
              variant="default"
            />
          </div>
        ) : (
          <div className={styles.placeholderShell}>
            <CyberStreamPlaceholder game={game} isLive={live} />
          </div>
        )}
        <div aria-hidden className={styles.mediaFade} />
      </div>

      <HeroNav multi={multi} onNext={onNext} onPrev={onPrev} />

      <div className={styles.panel}>
        <div className={styles.meta}>
          {live ? (
            <span className={styles.metaLive}>
              <i aria-hidden className={styles.liveDot} />
              {mapText || "LIVE"}
            </span>
          ) : (
            <span>{t("cyber.line")}</span>
          )}
          {league ? (
            <>
              <span className={styles.metaSep}>·</span>
              <span className={styles.metaItem}>{league}</span>
            </>
          ) : null}
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaItem}>{sportLabel}</span>
        </div>

        <Link className={styles.title} href={href}>
          {team1} vs {team2}
        </Link>

        <div className={styles.markets}>
          <div className={styles.outcome}>
            <div className={styles.outcomeMain}>
              <WcTeamImage
                iconUrl={game.team1Icon}
                size={36}
                teamName={game.team1 ?? ""}
              />
              <div className={styles.outcomeText}>
                <span className={styles.outcomeName}>{team1}</span>
                <OddsChanceBar cents={centsHome} odd={homeOddNum} tone="home" />
              </div>
            </div>
            <span className={styles.mapScore}>
              {scoreHome == null ? "–" : scoreHome}
            </span>
            <span className={styles.oddsX}>
              {homeOdd !== "—" ? `${homeOdd}x` : "—"}
            </span>
          </div>

          <div className={styles.outcome}>
            <div className={styles.outcomeMain}>
              <WcTeamImage
                iconUrl={game.team2Icon}
                size={36}
                teamName={game.team2 ?? ""}
              />
              <div className={styles.outcomeText}>
                <span className={styles.outcomeName}>{team2}</span>
                <OddsChanceBar cents={centsAway} odd={awayOddNum} tone="away" />
              </div>
            </div>
            <span className={styles.mapScore}>
              {scoreAway == null ? "–" : scoreAway}
            </span>
            <span className={styles.oddsX}>
              {awayOdd !== "—" ? `${awayOdd}x` : "—"}
            </span>
          </div>

          <div
            className={styles.ctaRow}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <HeroCta event={wcEvent} odd={homeOddNum} pick="HOME" tone="home" />
            <HeroCta event={wcEvent} odd={awayOddNum} pick="AWAY" tone="away" />
          </div>
        </div>
      </div>
    </section>
  );
}

function WcHeroSlide({
  event,
  multi,
  onPrev,
  onNext,
}: {
  event: WcEvent;
  multi: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { locale, t } = useLocale();
  const live = event.phase === "live";
  const href = buildWcGameHref(event);
  const homeTeam = event.homeTeam || "—";
  const awayTeam = event.awayTeam || "—";
  const league = event.leagueName || "";
  const homeOddNum = event.oddsHome;
  const awayOddNum = event.oddsAway;
  const homeOdd = formatWcCompactOdd(homeOddNum, "—");
  const awayOdd = formatWcCompactOdd(awayOddNum, "—");
  const [centsHome, centsAway] = impliedCents(homeOddNum, awayOddNum);
  const sportLabel = getSportLabel(event.sport, t);

  const liveTime = live ? formatWcRowLiveTime(event.parsedScore, event.sport) : null;
  const liveScore = live ? formatWcListLiveScore(event).main : null;
  const kickoff = !live ? formatWcCompactTime(event.commenceTime, locale) : null;
  const scoreHome =
    live && event.homeScore != null ? event.homeScore : null;
  const scoreAway =
    live && event.awayScore != null ? event.awayScore : null;
  const placeholderScore =
    liveScore ||
    (scoreHome != null && scoreAway != null ? `${scoreHome}:${scoreAway}` : "vs");

  const broadcastMeta = {
    homeTeam,
    awayTeam,
    leagueName: league,
    homeTeamIcon: event.homeTeamIcon ?? null,
    awayTeamIcon: event.awayTeamIcon ?? null,
  };

  return (
    <section className={styles.card}>
      <div className={styles.media}>
        <Link
          aria-label={`${homeTeam} vs ${awayTeam}`}
          className={styles.hit}
          href={href}
          tabIndex={-1}
        />
        {event.hasBroadcast ? (
          <div className={styles.playerShell}>
            <WcBroadcastPlayer
              autoPlayWithSound
              eventRef={event.id}
              hasBroadcast
              hideChrome
              meta={broadcastMeta}
              showFullscreen={false}
              sport={event.sport}
              variant="default"
            />
          </div>
        ) : (
          <div className={styles.placeholderShell}>
            <WcTeamsPlaceholder
              awayIcon={event.awayTeamIcon}
              awayTeam={awayTeam}
              homeIcon={event.homeTeamIcon}
              homeTeam={homeTeam}
              live={live}
              scoreText={placeholderScore}
            />
          </div>
        )}
        <div aria-hidden className={styles.mediaFade} />
      </div>

      <HeroNav multi={multi} onNext={onNext} onPrev={onPrev} />

      <div className={styles.panel}>
        <div className={styles.meta}>
          {live ? (
            <span className={styles.metaLive}>
              <i aria-hidden className={styles.liveDot} />
              {liveTime || "LIVE"}
            </span>
          ) : kickoff ? (
            <span>
              {kickoff.date} · {kickoff.time}
            </span>
          ) : (
            <span>{t("cyber.line")}</span>
          )}
          {league ? (
            <>
              <span className={styles.metaSep}>·</span>
              <span className={styles.metaItem}>{league}</span>
            </>
          ) : null}
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaItem}>{sportLabel}</span>
        </div>

        <Link className={styles.title} href={href}>
          {homeTeam} vs {awayTeam}
        </Link>

        <div className={styles.markets}>
          <div className={styles.outcome}>
            <div className={styles.outcomeMain}>
              <WcTeamImage
                iconUrl={event.homeTeamIcon}
                size={36}
                teamName={homeTeam}
              />
              <div className={styles.outcomeText}>
                <span className={styles.outcomeName}>{homeTeam}</span>
                <OddsChanceBar cents={centsHome} odd={homeOddNum} tone="home" />
              </div>
            </div>
            <span className={styles.mapScore}>
              {scoreHome == null ? "–" : scoreHome}
            </span>
            <span className={styles.oddsX}>
              {homeOdd !== "—" ? `${homeOdd}x` : "—"}
            </span>
          </div>

          <div className={styles.outcome}>
            <div className={styles.outcomeMain}>
              <WcTeamImage
                iconUrl={event.awayTeamIcon}
                size={36}
                teamName={awayTeam}
              />
              <div className={styles.outcomeText}>
                <span className={styles.outcomeName}>{awayTeam}</span>
                <OddsChanceBar cents={centsAway} odd={awayOddNum} tone="away" />
              </div>
            </div>
            <span className={styles.mapScore}>
              {scoreAway == null ? "–" : scoreAway}
            </span>
            <span className={styles.oddsX}>
              {awayOdd !== "—" ? `${awayOdd}x` : "—"}
            </span>
          </div>

          <div
            className={styles.ctaRow}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <HeroCta event={event} odd={homeOddNum} pick="HOME" tone="home" />
            <HeroCta event={event} odd={awayOddNum} pick="AWAY" tone="away" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSlide({
  slide,
  multi,
  onPrev,
  onNext,
}: {
  slide: HomeHeroSlide;
  multi: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (slide.kind === "cyber") {
    return (
      <CyberHeroSlide
        game={slide.game}
        multi={multi}
        onNext={onNext}
        onPrev={onPrev}
      />
    );
  }
  return (
    <WcHeroSlide
      event={slide.event}
      multi={multi}
      onNext={onNext}
      onPrev={onPrev}
    />
  );
}

export function CyberHomeHeroBanner() {
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const { data: featured = [], isLoading } = useHomeHeroFeatured();

  useEffect(() => {
    if (index >= featured.length) setIndex(0);
  }, [featured.length, index]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (featured.length < 2) return;
      setIndex((i) => (i + dir + featured.length) % featured.length);
    },
    [featured.length],
  );

  if (isLoading || featured.length === 0) return null;

  const current = featured[Math.min(index, featured.length - 1)]!;

  return (
    <div className={styles.wrap} aria-label={t("cyber.liveAria")}>
      <HeroSlide
        key={current.key}
        multi={featured.length > 1}
        onNext={() => go(1)}
        onPrev={() => go(-1)}
        slide={current}
      />
    </div>
  );
}
