"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWcEventBroadcast } from "~/entities/wc-odds/api/client";
import {
  isBroadcastAuthed,
  requestBroadcastAuth,
} from "~/entities/wc-odds/lib/wcBroadcastAuth";
import type { WcBroadcastMeta } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { isEsportsSport } from "~/entities/cybersport/lib/isEsportsSport";
import { buildKickEmbedUrl, isKickPlayerUrl } from "~/entities/wc-odds/lib/kickEmbedUrl";
import { resolveLiveEsportsStream } from "~/entities/wc-odds/lib/streamLiveFallback";
import { buildTwitchEmbedUrl, isTwitchPlayerUrl } from "~/entities/wc-odds/lib/twitchEmbedUrl";
import { BroadcastIcon, CloseIcon, LockIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { MQ_BELOW_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";

import styles from "~/entities/wc-odds/ui/WcBroadcastPlayer.module.css";

type WcBroadcastPlayerProps = {
  eventRef: string;
  hasBroadcast?: boolean;
  meta?: WcBroadcastMeta | null;
  sport?: string | null;
  variant?: "default" | "sidebar";
  compactModal?: boolean;
  showClose?: boolean;
  showFullscreen?: boolean;
  onClose?: () => void;
  onFullscreen?: () => void;
};

const MOBILE_CONTROLS_HIDE_MS = 4000;

function StreamVideoShell({
  children,
  className,
  controls,
  controlsVisible,
  fallbackBadge,
  isMobile,
  onRevealControls,
}: {
  children: React.ReactNode;
  className?: string;
  controls: React.ReactNode;
  controlsVisible: boolean;
  fallbackBadge?: React.ReactNode;
  isMobile: boolean;
  onRevealControls: () => void;
}) {
  const showControls = !isMobile || controlsVisible;

  return (
    <div
      className={cn(
        styles.videoShell,
        className,
        isMobile && styles.videoShellMobile,
        controlsVisible && styles.videoShellControlsVisible,
      )}
    >
      {children}
      {isMobile && !controlsVisible ? (
        <button
          aria-label="Показать управление трансляцией"
          className={styles.tapCatcher}
          onClick={(event) => {
            event.stopPropagation();
            onRevealControls();
          }}
          type="button"
        />
      ) : null}
      {showControls ? controls : null}
      {fallbackBadge}
    </div>
  );
}

function StreamControls({
  isMuted,
  isMobile,
  onFullscreen,
  onToggleMute,
  showFullscreen,
}: {
  isMuted: boolean;
  isMobile: boolean;
  onFullscreen?: () => void;
  onToggleMute: () => void;
  showFullscreen?: boolean;
}) {
  return (
    <div className={cn(styles.videoControls, isMobile && styles.videoControlsMobile)}>
      <button className={styles.soundToggle} onClick={onToggleMute} type="button">
        {isMuted ? "Включить звук" : "Выключить звук"}
      </button>
      {showFullscreen && onFullscreen ? (
        <button className={styles.fullscreenToggle} onClick={onFullscreen} type="button">
          На весь экран
        </button>
      ) : null}
    </div>
  );
}

function BroadcastAuthGate({
  meta,
  showMatchTitle = true,
  layout = "default",
  onLogin,
  onRegister,
}: {
  meta?: WcBroadcastMeta | null;
  showMatchTitle?: boolean;
  layout?: "default" | "sidebar";
  onLogin: () => void;
  onRegister: () => void;
}) {
  const matchLine = meta ? `${meta.homeTeam} – ${meta.awayTeam}` : null;

  if (layout === "sidebar") {
    return (
      <div className={styles.authGateSidebar}>
        <div aria-hidden className={styles.authGateBackdrop} />
        <div className={styles.authGateSidebarInner}>
          <div className={styles.authGateSidebarHead}>
            <div className={styles.authGateSidebarIconWrap}>
              <LockIcon className={styles.authGateSidebarIcon} />
            </div>
            <p className={styles.authGateSidebarTitle}>Чтобы смотреть трансляцию</p>
          </div>
          <div className={styles.authGateSidebarActions}>
            <button
              className={styles.authGateSidebarPrimary}
              onClick={onRegister}
              type="button"
            >
              Регистрация
            </button>
            <button
              className={styles.authGateSidebarSecondary}
              onClick={onLogin}
              type="button"
            >
              Вход
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authGate}>
      <div aria-hidden className={styles.authGateBackdrop} />
      <div className={styles.authGateCard}>
        <span className={styles.authGateBadge}>LIVE</span>
        {showMatchTitle && matchLine ? (
          <div className={styles.authGatePreview}>
            <div className={styles.authGatePreviewTeams}>
              <WcTeamImage
                iconUrl={meta?.homeTeamIcon}
                size={36}
                teamName={meta?.homeTeam ?? ""}
              />
              <span className={styles.authGatePreviewVs}>vs</span>
              <WcTeamImage
                iconUrl={meta?.awayTeamIcon}
                size={36}
                teamName={meta?.awayTeam ?? ""}
              />
            </div>
            {meta?.leagueName ? (
              <p className={styles.authGateLeague}>{meta.leagueName}</p>
            ) : null}
            <p className={styles.authGateMatch}>{matchLine}</p>
          </div>
        ) : null}
        <div className={styles.authGateIconWrap}>
          <LockIcon className={styles.authGateIcon} />
        </div>
        <h3 className={styles.authGateTitle}>Чтобы смотреть трансляцию</h3>
        <p className={styles.authGateHint}>
          {showMatchTitle && matchLine
            ? "Эфир доступен после входа в аккаунт"
            : "Зарегистрируйтесь или войдите в аккаунт"}
        </p>
        <div className={styles.authGateActions}>
          <button className={styles.authGatePrimary} onClick={onRegister} type="button">
            Регистрация
          </button>
          <button className={styles.authGateSecondary} onClick={onLogin} type="button">
            Вход
          </button>
        </div>
      </div>
    </div>
  );
}

function BroadcastMedia({
  eventRef,
  streamUrl,
  streamType,
  error,
  videoRef,
  needsTap,
  onTapPlay,
  isMuted,
  onToggleMute,
  onFullscreen,
  showFullscreen,
  isFallback,
  fallbackLabel,
  isMobile,
  controlsVisible,
  onRevealControls,
  onControlAction,
}: {
  eventRef: string;
  streamUrl: string | null;
  streamType: string | null;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  needsTap?: boolean;
  onTapPlay?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
  isFallback?: boolean;
  fallbackLabel?: string | null;
  isMobile: boolean;
  controlsVisible: boolean;
  onRevealControls: () => void;
  onControlAction: (action: () => void) => (event: React.MouseEvent) => void;
}) {
  const controls = (
    <StreamControls
      isMobile={isMobile}
      isMuted={isMuted}
      onFullscreen={onFullscreen ? onControlAction(onFullscreen) : undefined}
      onToggleMute={onControlAction(onToggleMute)}
      showFullscreen={showFullscreen}
    />
  );

  const fallbackBadge = isFallback ? (
    <span className={styles.fallbackBadge}>
      <span aria-hidden className={styles.fallbackDot} />
      {fallbackLabel ?? "Резервный эфир · EN"}
    </span>
  ) : null;

  if (streamUrl && streamType === "iframe") {
    const isTwitch = isTwitchPlayerUrl(streamUrl);
    const isKick = isKickPlayerUrl(streamUrl);
    return (
      <StreamVideoShell
        className={cn(
          isTwitch && styles.videoShellTwitch,
          isKick && styles.videoShellKick,
        )}
        controls={controls}
        controlsVisible={controlsVisible}
        fallbackBadge={fallbackBadge}
        isMobile={isMobile}
        onRevealControls={onRevealControls}
      >
        <iframe
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className={styles.broadcastVideo}
          data-embed-provider={isTwitch ? "twitch" : isKick ? "kick" : "iframe"}
          height="100%"
          referrerPolicy="no-referrer-when-downgrade"
          src={streamUrl}
          title={`Трансляция ${eventRef}`}
          width="100%"
        />
      </StreamVideoShell>
    );
  }

  if (streamUrl) {
    return (
      <StreamVideoShell
        controls={controls}
        controlsVisible={controlsVisible}
        isMobile={isMobile}
        onRevealControls={onRevealControls}
      >
        <video
          ref={videoRef}
          autoPlay
          className={styles.broadcastVideo}
          controls={!isMobile}
          muted={isMuted}
          playsInline
        />
        {needsTap && (
          <button className={styles.tapPlayBtn} onClick={onTapPlay} type="button">
            Смотреть трансляцию
          </button>
        )}
      </StreamVideoShell>
    );
  }

  return (
    <div className={styles.broadcastPlaceholder}>
      <span className={styles.broadcastBadge}>LIVE</span>
      <p>{error ?? "Видеотрансляция матча"}</p>
    </div>
  );
}

function setEmbedMuted(raw: string | null, muted: boolean): string | null {
  if (!raw) return raw;
  try {
    const relative = raw.startsWith("/");
    const base = typeof window !== "undefined" ? window.location.origin : "https://imba.bet";
    const url = new URL(raw, base);
    if (relative || isKickPlayerUrl(raw) || isTwitchPlayerUrl(raw)) {
      url.searchParams.set("muted", String(muted));
      if (isKickPlayerUrl(raw)) url.searchParams.set("autoplay", "true");
    }
    return relative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return raw;
  }
}

export function WcBroadcastPlayer({
  eventRef,
  hasBroadcast,
  meta,
  sport,
  variant = "default",
  compactModal = false,
  showClose = false,
  showFullscreen = false,
  onClose,
  onFullscreen,
}: WcBroadcastPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimer = useRef<number | undefined>(undefined);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string | null>(null);
  const [available, setAvailable] = useState(Boolean(hasBroadcast));
  const [authRequired, setAuthRequired] = useState(() => !isBroadcastAuthed());
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [iframeEmbed, setIframeEmbed] = useState<string | null>(null);
  const [streamFallback, setStreamFallback] = useState(false);
  const [fallbackLabel, setFallbackLabel] = useState<string | null>(null);
  const [streamResolving, setStreamResolving] = useState(false);
  const [hlsNoAudio, setHlsNoAudio] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_BELOW_DESKTOP);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, MOBILE_CONTROLS_HIDE_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => () => {
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current);
    }
  }, []);

  const onControlAction = useCallback((action: () => void) => {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      action();
      if (isMobile) scheduleHideControls();
    };
  }, [isMobile, scheduleHideControls]);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsTap(false);
    void video.play().catch(() => setNeedsTap(true));
  }, []);

  const toggleSound = useCallback(() => {
    setSoundMuted((current) => {
      const next = !current;
      const video = videoRef.current;
      if (video) {
        video.muted = next;
        video.volume = next ? 0 : 1;
        if (!next) void video.play().catch(() => setNeedsTap(true));
      }
      return next;
    });
  }, []);

  const loadStreamUrl = useCallback(async () => {
    if (!isBroadcastAuthed()) {
      setAuthRequired(true);
      setAvailable(false);
      setStreamUrl(null);
      setStreamType(null);
      return null;
    }

    try {
      const payload = await fetchWcEventBroadcast(eventRef);
      if (payload.requiresAuth) {
        setAuthRequired(true);
        setAvailable(false);
        setStreamUrl(null);
        setStreamType(null);
        return null;
      }

      setAuthRequired(false);
      setAvailable(payload.available);

      let nextUrl = payload.streamUrl;
      let nextType = payload.streamType;

      if (payload.provider === "kick" && payload.kickChannel) {
        nextUrl = buildKickEmbedUrl(payload.kickChannel);
        nextType = "iframe";
      } else if (payload.provider === "twitch" && payload.twitchChannel) {
        nextUrl = buildTwitchEmbedUrl(payload.twitchChannel);
        nextType = "iframe";
      } else if (nextUrl && isKickPlayerUrl(nextUrl)) {
        const channel = new URL(nextUrl).pathname.split("/").filter(Boolean).pop();
        if (channel) nextUrl = buildKickEmbedUrl(channel);
        nextType = "iframe";
      } else if (nextUrl && isTwitchPlayerUrl(nextUrl)) {
        const channel = new URL(nextUrl).searchParams.get("channel")
          ?? new URL(nextUrl).pathname.split("/").filter(Boolean)[0];
        if (channel) nextUrl = buildTwitchEmbedUrl(channel);
        nextType = "iframe";
      }

      setStreamFallback(Boolean(payload.streamFallback));
      setFallbackLabel(
        payload.provider === "twitch"
          ? "EN резерв · Twitch"
          : payload.streamFallback
            ? "Резервный эфир · EN"
            : null,
      );

      setStreamUrl(nextUrl);
      setStreamType(nextType);
      if (payload.available && !nextUrl) {
        setError("Трансляция доступна, поток подключается…");
      } else if (nextUrl) {
        setError(null);
      }
      return nextUrl;
    } catch {
      setError("Не удалось загрузить трансляцию");
      return null;
    }
  }, [eventRef]);

  useEffect(() => {
    if (!hasBroadcast) return undefined;

    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      const url = await loadStreamUrl();
      if (!cancelled && !url) {
        timer = window.setTimeout(tick, 15_000);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [hasBroadcast, loadStreamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (streamType === "iframe") return undefined;
    if (!video || !streamUrl) return undefined;

    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    let recovering = false;

    const refreshOnFailure = () => {
      if (recovering || cancelled) return;
      recovering = true;
      void loadStreamUrl().finally(() => {
        recovering = false;
      });
    };

    const playNative = () => {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setError("Браузер не поддерживает воспроизведение трансляции");
        return;
      }
      video.src = streamUrl;
      video.addEventListener("error", refreshOnFailure);
      video.addEventListener("loadedmetadata", () => {
        const mozHasAudio = (video as HTMLVideoElement & { mozHasAudio?: boolean }).mozHasAudio;
        if (mozHasAudio === false) {
          setHlsNoAudio(true);
        }
      }, { once: true });
      void video.play().catch(() => setNeedsTap(true));
    };

    const attach = async () => {
      try {
        const mod = await import("hls.js");
        const Hls = mod.default;
        if (cancelled) return;
        if (!Hls.isSupported()) {
          playNative();
          return;
        }
        const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
        instance.loadSource(streamUrl);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (instance.audioTracks.length === 0) {
            setHlsNoAudio(true);
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) refreshOnFailure();
        });
        void video.play().catch(() => setNeedsTap(true));
        hls = instance;
      } catch {
        playNative();
      }
    };

    void attach();

    return () => {
      cancelled = true;
      video.removeEventListener("error", refreshOnFailure);
      hls?.destroy();
    };
  }, [streamUrl, streamType, loadStreamUrl]);

  const esportsStream = isEsportsSport(sport);

  // Silent HLS in-game feed — switch to Kick/Twitch with commentary audio (esports only).
  useEffect(() => {
    if (!esportsStream || !hlsNoAudio || streamType === "iframe" || !sport) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      const pick = await resolveLiveEsportsStream(null, sport, controller.signal);
      if (cancelled || !pick) return;
      setStreamUrl(pick.embedUrl);
      setStreamType("iframe");
      setIframeEmbed(pick.embedUrl);
      setStreamFallback(pick.isFallback);
      setFallbackLabel(
        pick.provider === "twitch"
          ? "EN резерв · Twitch"
          : pick.isFallback
            ? "Резервный эфир · EN"
            : null,
      );
      setHlsNoAudio(false);
      setError(null);
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [esportsStream, hlsNoAudio, sport, streamType]);

  useEffect(() => {
    if (streamType !== "iframe" || !streamUrl) {
      setIframeEmbed(streamUrl);
      setStreamFallback(false);
      setFallbackLabel(null);
      setStreamResolving(false);
      return undefined;
    }

    if (isTwitchPlayerUrl(streamUrl)) {
      setIframeEmbed(streamUrl);
      setStreamResolving(false);
      return undefined;
    }

    if (!esportsStream) {
      setIframeEmbed(streamUrl);
      setStreamResolving(false);
      return undefined;
    }

    let primaryKick: string | null = null;
    try {
      if (isKickPlayerUrl(streamUrl)) {
        primaryKick = new URL(streamUrl).pathname.split("/").filter(Boolean)[0] ?? null;
      }
    } catch {
      primaryKick = null;
    }

    if (!primaryKick && !isKickPlayerUrl(streamUrl)) {
      setIframeEmbed(streamUrl);
      setStreamResolving(false);
      return undefined;
    }

    if (streamUrl.startsWith("/api/feed/events/")) {
      setIframeEmbed(streamUrl);
      setStreamResolving(false);
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;
    const controller = new AbortController();

    const run = async () => {
      setStreamResolving(true);
      const pick = await resolveLiveEsportsStream(primaryKick, sport, controller.signal);
      if (cancelled) return;
      setStreamResolving(false);
      if (pick) {
        setIframeEmbed(pick.embedUrl);
        setStreamFallback(pick.isFallback);
        setFallbackLabel(
          pick.provider === "twitch"
            ? "EN резерв · Twitch"
            : pick.isFallback
              ? "Резервный эфир · EN"
              : null,
        );
      } else {
        setIframeEmbed(streamUrl);
        setStreamFallback(false);
        setFallbackLabel(null);
      }
      timer = window.setTimeout(run, 60_000);
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [esportsStream, streamType, streamUrl, sport]);

  if (!hasBroadcast && !available && !authRequired) return null;

  const iframeUrl = streamType === "iframe" ? setEmbedMuted(iframeEmbed, soundMuted) : streamUrl;
  const mediaError =
    streamType === "iframe" && !iframeUrl
      ? streamResolving
        ? "Подбираем рабочую трансляцию…"
        : "Трансляция офлайн — рабочего эфира сейчас нет"
      : error;

  const media = authRequired ? (
    <BroadcastAuthGate
      layout={variant === "sidebar" && !compactModal ? "sidebar" : "default"}
      meta={meta}
      showMatchTitle={variant !== "sidebar"}
      onLogin={() => requestBroadcastAuth("login")}
      onRegister={() => requestBroadcastAuth("register")}
    />
  ) : (
    <BroadcastMedia
      controlsVisible={controlsVisible}
      error={mediaError}
      eventRef={eventRef}
      isFallback={streamFallback}
      fallbackLabel={fallbackLabel}
      isMobile={isMobile}
      isMuted={soundMuted}
      needsTap={needsTap}
      onControlAction={onControlAction}
      onFullscreen={onFullscreen}
      onRevealControls={revealControls}
      onTapPlay={tryPlay}
      onToggleMute={toggleSound}
      showFullscreen={showFullscreen}
      streamType={streamType}
      streamUrl={streamType === "iframe" ? iframeUrl : streamUrl}
      videoRef={videoRef}
    />
  );

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          styles.broadcastCard,
          !compactModal && styles.broadcastCardSidebar,
          compactModal && styles.broadcastCardMobileModal,
        )}
      >
        <div className={styles.broadcastHeader}>
          <div className={styles.broadcastHeaderMain}>
            <span className={styles.broadcastHeaderIconWrap}>
              <BroadcastIcon className={styles.broadcastHeaderIcon} />
            </span>
            <div className={styles.broadcastHeaderText}>
              {meta?.leagueName && (
                <p className={styles.broadcastLeague}>{meta.leagueName}</p>
              )}
              {meta && (
                <p className={styles.broadcastMatch}>
                  {meta.homeTeam} – {meta.awayTeam}
                </p>
              )}
              {!meta && <p className={styles.broadcastMatch}>Видеотрансляция</p>}
            </div>
          </div>
          {showClose && onClose && (
            <button
              aria-label="Закрыть трансляцию"
              className={styles.headerCloseBtn}
              onClick={onClose}
              type="button"
            >
              <CloseIcon className={styles.headerCloseIcon} />
            </button>
          )}
        </div>
        <div className={styles.broadcastBody}>{media}</div>
      </div>
    );
  }

  return (
    <div className={styles.broadcastWrap}>
      {showClose && onClose && (
        <button
          aria-label="Закрыть трансляцию"
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
        >
          <CloseIcon className={styles.closeIcon} />
        </button>
      )}
      {media}
    </div>
  );
}
