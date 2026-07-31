"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { fetchWcEventBroadcast } from "~/entities/wc-odds/api/client";
import {
  isBroadcastAuthed,
  requestBroadcastAuth,
} from "~/entities/wc-odds/lib/wcBroadcastAuth";
import type { WcBroadcastMeta } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { useBroadcastPlayerLayout } from "~/entities/wc-odds/lib/useBroadcastPlayerLayout";
import { buildKickEmbedUrl, isKickPlayerUrl } from "~/entities/wc-odds/lib/kickEmbedUrl";
import { buildTwitchEmbedUrl, isTwitchPlayerUrl } from "~/entities/wc-odds/lib/twitchEmbedUrl";
import { BroadcastIcon, CloseIcon, LockIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { MQ_BELOW_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { useLocale } from "~/shared/model/useLocale";
import { WcTeamImage } from "~/entities/wc-odds/ui/WcTeamImage";
import { StreamSocialOverlay } from "~/entities/wc-odds/ui/StreamSocialOverlay";

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
  /** Start unmuted and try autoplay with audio (browsers may still require a tap). */
  autoPlayWithSound?: boolean;
  /** Hide native video controls, mute UI, and stream social overlay. */
  hideChrome?: boolean;
};

const MOBILE_CONTROLS_HIDE_MS = 4000;

function StreamVideoShell({
  children,
  className,
  controls,
  controlsVisible,
  fallbackBadge,
  hideChrome = false,
  isMobile,
  onRevealControls,
  showSocialOverlay = true,
  streamKey,
  t,
}: {
  children: React.ReactNode;
  className?: string;
  controls: React.ReactNode;
  controlsVisible: boolean;
  fallbackBadge?: React.ReactNode;
  hideChrome?: boolean;
  isMobile: boolean;
  onRevealControls: () => void;
  showSocialOverlay?: boolean;
  streamKey?: string | null;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const showControls = !hideChrome && (!isMobile || controlsVisible);

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
      {!hideChrome && isMobile && !controlsVisible ? (
        <button
          aria-label={t("wc.showControls")}
          className={styles.tapCatcher}
          onClick={(event) => {
            event.stopPropagation();
            onRevealControls();
          }}
          type="button"
        />
      ) : null}
      {showSocialOverlay && streamKey ? (
        <StreamSocialOverlay streamKey={streamKey} />
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
  showMute = true,
  t,
}: {
  isMuted: boolean;
  isMobile: boolean;
  onFullscreen?: () => void;
  onToggleMute: () => void;
  showFullscreen?: boolean;
  showMute?: boolean;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const hasFullscreen = Boolean(showFullscreen && onFullscreen);
  if (!showMute && !hasFullscreen) return null;

  return (
    <div className={cn(styles.videoControls, isMobile && styles.videoControlsMobile)}>
      {showMute ? (
        <button className={styles.soundToggle} onClick={onToggleMute} type="button">
          {isMuted ? t("wc.muteOn") : t("wc.muteOff")}
        </button>
      ) : null}
      {hasFullscreen ? (
        <button className={styles.fullscreenToggle} onClick={onFullscreen} type="button">
          {t("wc.fullscreen")}
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
  t,
}: {
  meta?: WcBroadcastMeta | null;
  showMatchTitle?: boolean;
  layout?: "default" | "sidebar";
  onLogin: () => void;
  onRegister: () => void;
  t: ReturnType<typeof useLocale>["t"];
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
            <p className={styles.authGateSidebarTitle}>{t("wc.authWatchTitle")}</p>
          </div>
          <div className={styles.authGateSidebarActions}>
            <button
              className={styles.authGateSidebarPrimary}
              onClick={onRegister}
              type="button"
            >
              {t("auth.register")}
            </button>
            <button
              className={styles.authGateSidebarSecondary}
              onClick={onLogin}
              type="button"
            >
              {t("auth.login")}
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
        <h3 className={styles.authGateTitle}>{t("wc.authWatchTitle")}</h3>
        <p className={styles.authGateHint}>
          {showMatchTitle && matchLine
            ? t("wc.authWatchNeedLogin")
            : t("wc.authWatchRegisterOrLogin")}
        </p>
        <div className={styles.authGateActions}>
          <button className={styles.authGatePrimary} onClick={onRegister} type="button">
            {t("auth.register")}
          </button>
          <button className={styles.authGateSecondary} onClick={onLogin} type="button">
            {t("auth.login")}
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
  showMute = true,
  showNativeControls = true,
  showSocialOverlay = true,
  hideChrome = false,
  isFallback,
  fallbackLabel,
  isMobile,
  controlsVisible,
  onRevealControls,
  onControlAction,
  t,
}: {
  eventRef: string;
  streamUrl: string | null;
  streamType: string | null;
  error: string | null;
  videoRef: React.Ref<HTMLVideoElement | null>;
  needsTap?: boolean;
  onTapPlay?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
  showMute?: boolean;
  showNativeControls?: boolean;
  showSocialOverlay?: boolean;
  hideChrome?: boolean;
  isFallback?: boolean;
  fallbackLabel?: string | null;
  isMobile: boolean;
  controlsVisible: boolean;
  onRevealControls: () => void;
  onControlAction: (action: () => void) => (event: React.MouseEvent) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const controls = (
    <StreamControls
      isMobile={isMobile}
      isMuted={isMuted}
      onFullscreen={onFullscreen ? onControlAction(onFullscreen) : undefined}
      onToggleMute={onControlAction(onToggleMute)}
      showFullscreen={showFullscreen}
      showMute={showMute}
      t={t}
    />
  );

  const fallbackBadge = isFallback ? (
    <span className={styles.fallbackBadge}>
      <span aria-hidden className={styles.fallbackDot} />
      {fallbackLabel ?? t("wc.fallbackEn")}
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
        hideChrome={hideChrome}
        isMobile={isMobile}
        onRevealControls={onRevealControls}
        showSocialOverlay={showSocialOverlay}
        streamKey={eventRef}
        t={t}
      >
        <iframe
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className={styles.broadcastVideo}
          data-embed-provider={isTwitch ? "twitch" : isKick ? "kick" : "iframe"}
          height="100%"
          referrerPolicy="no-referrer-when-downgrade"
          src={streamUrl}
          title={t("wc.broadcastTitle", { ref: eventRef })}
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
        hideChrome={hideChrome}
        isMobile={isMobile}
        onRevealControls={onRevealControls}
        showSocialOverlay={showSocialOverlay}
        streamKey={eventRef}
        t={t}
      >
        <video
          ref={videoRef}
          autoPlay
          className={styles.broadcastVideo}
          controls={showNativeControls && !isMobile}
          muted={isMuted}
          playsInline
        />
        {needsTap && (
          <button className={styles.tapPlayBtn} onClick={onTapPlay} type="button">
            {t("wc.watchBroadcast")}
          </button>
        )}
      </StreamVideoShell>
    );
  }

  return (
    <div className={styles.broadcastPlaceholder}>
      <span className={styles.broadcastBadge}>LIVE</span>
      <p>{error ?? t("wc.broadcastMatch")}</p>
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
  autoPlayWithSound = false,
  hideChrome = false,
}: WcBroadcastPlayerProps) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);
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
  const [soundMuted, setSoundMuted] = useState(!autoPlayWithSound);
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
    video.muted = soundMuted;
    video.volume = soundMuted ? 0 : 1;
    void video.play().catch(() => setNeedsTap(true));
  }, [soundMuted]);

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
          ? t("wc.fallbackTwitch")
          : payload.streamFallback
            ? t("wc.fallbackEn")
            : null,
      );

      setStreamUrl(nextUrl);
      setStreamType(nextType);
      if (payload.available && !nextUrl) {
        setError(t("wc.connecting"));
      } else if (nextUrl) {
        setError(null);
      }
      return nextUrl;
    } catch {
      setError(t("wc.loadFailed"));
      return null;
    }
  }, [eventRef, t]);

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
    const video = videoEl;
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
        setError(t("wc.browserUnsupported"));
        return;
      }
      video.src = streamUrl;
      video.addEventListener("error", refreshOnFailure);
      video.muted = soundMuted;
      video.volume = soundMuted ? 0 : 1;
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
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) refreshOnFailure();
        });
        video.muted = soundMuted;
        video.volume = soundMuted ? 0 : 1;
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
  }, [videoEl, streamUrl, streamType, loadStreamUrl, soundMuted, t]);

  useEffect(() => {
    if (streamType !== "iframe" || !streamUrl) {
      setIframeEmbed(streamUrl);
      setStreamFallback(false);
      setFallbackLabel(null);
      setStreamResolving(false);
      return undefined;
    }

    // Trust backend /play: no client-side ESL/Blast Kick or Twitch re-resolve.
    setIframeEmbed(streamUrl);
    setStreamFallback(false);
    setFallbackLabel(null);
    setStreamResolving(false);
    return undefined;
  }, [streamType, streamUrl]);

  if (!hasBroadcast && !available && !authRequired) return null;

  const iframeUrl = streamType === "iframe" ? setEmbedMuted(iframeEmbed, soundMuted) : streamUrl;
  const mediaError =
    streamType === "iframe" && !iframeUrl
      ? streamResolving
        ? t("wc.pickingStream")
        : t("wc.offline")
      : error;

  const media = authRequired ? (
    <BroadcastAuthGate
      layout={variant === "sidebar" && !compactModal ? "sidebar" : "default"}
      meta={meta}
      showMatchTitle={variant !== "sidebar"}
      onLogin={() => requestBroadcastAuth("login")}
      onRegister={() => requestBroadcastAuth("register")}
      t={t}
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
      showFullscreen={hideChrome ? false : showFullscreen}
      showMute={false}
      showNativeControls={!hideChrome}
      showSocialOverlay={!hideChrome}
      hideChrome={hideChrome}
      streamType={streamType}
      streamUrl={streamType === "iframe" ? iframeUrl : streamUrl}
      t={t}
      videoRef={setVideoRef}
    />
  );

  if (variant === "sidebar") {
    return (
      <SidebarBroadcastChrome
        compactModal={compactModal}
        media={media}
        meta={meta}
        onClose={onClose}
        showClose={showClose}
        t={t}
      />
    );
  }

  return (
    <div className={styles.broadcastWrap}>
      {showClose && onClose && (
        <button
          aria-label={t("wc.closeBroadcast")}
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

function SidebarBroadcastChrome({
  compactModal,
  media,
  meta,
  onClose,
  showClose,
  t,
}: {
  compactModal: boolean;
  media: ReactNode;
  meta?: WcBroadcastMeta | null;
  onClose?: () => void;
  showClose?: boolean;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const { layout, hydrated, undockToFloat, dock, beginPointerDrag } =
    useBroadcastPlayerLayout();
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const header = (
    <div
      className={cn(
        styles.broadcastHeader,
        layout.mode === "float" && styles.broadcastHeaderDraggable,
      )}
      onPointerDown={
        layout.mode === "float"
          ? (event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              event.preventDefault();
              beginPointerDrag({
                kind: "float-move",
                startX: event.clientX,
                startY: event.clientY,
              });
            }
          : undefined
      }
    >
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
          {!meta && <p className={styles.broadcastMatch}>{t("wc.videoBroadcast")}</p>}
        </div>
      </div>
      <div className={styles.broadcastHeaderActions}>
        {!compactModal ? (
          layout.mode === "float" ? (
            <button
              aria-label={t("wc.toSidebarAria")}
              className={styles.headerActionBtn}
              onClick={dock}
              title={t("wc.toSidebar")}
              type="button"
            >
              ↙
            </button>
          ) : (
            <button
              aria-label={t("wc.unpinAria")}
              className={styles.headerActionBtn}
              onClick={undockToFloat}
              title={t("wc.unpinTitle")}
              type="button"
            >
              ↗
            </button>
          )
        ) : null}
        {showClose && onClose ? (
          <button
            aria-label={t("wc.closeBroadcast")}
            className={styles.headerCloseBtn}
            onClick={onClose}
            type="button"
          >
            <CloseIcon className={styles.headerCloseIcon} />
          </button>
        ) : null}
      </div>
    </div>
  );

  const body = (
    <div
      className={cn(
        styles.broadcastBody,
        hydrated && !compactModal && styles.broadcastBody_sized,
      )}
      style={
        hydrated && !compactModal
          ? {
              ["--broadcast-video-h" as string]: `${layout.height}px`,
            }
          : undefined
      }
    >
      <div className={styles.broadcastBodyMedia}>{media}</div>
      {layout.mode === "float" && !compactModal ? (
        <button
          aria-label={t("wc.expandAria")}
          className={styles.resizeCorner}
          onPointerDown={(event) => {
            event.preventDefault();
            beginPointerDrag({
              kind: "float-resize",
              startX: event.clientX,
              startY: event.clientY,
            });
          }}
          type="button"
        />
      ) : null}
    </div>
  );

  if (compactModal) {
    return (
      <div
        className={cn(
          styles.broadcastCard,
          styles.broadcastCardMobileModal,
        )}
      >
        {header}
        {body}
      </div>
    );
  }

  const card = (
    <div
      className={cn(
        styles.broadcastCard,
        layout.mode === "float"
          ? styles.broadcastCardFloat
          : styles.broadcastCardSidebar,
      )}
      style={
        layout.mode === "float"
          ? {
              width: layout.width,
              top: layout.y,
              left: layout.x,
            }
          : undefined
      }
    >
      {header}
      {body}
    </div>
  );

  // Portal only for float so sticky coupon overflow doesn't clip the window.
  // HLS re-attaches via videoEl callback ref when <video> remounts in the portal.
  if (layout.mode === "float" && portalReady) {
    return createPortal(card, document.body);
  }

  return card;
}
