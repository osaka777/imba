"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWcEventBroadcast } from "~/entities/wc-odds/api/client";
import type { WcBroadcastMeta } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { BroadcastIcon, CloseIcon } from "~/shared/assets";

import styles from "~/entities/wc-odds/ui/WcBroadcastPlayer.module.css";

type WcBroadcastPlayerProps = {
  eventRef: string;
  hasBroadcast?: boolean;
  meta?: WcBroadcastMeta | null;
  variant?: "default" | "sidebar";
  showClose?: boolean;
  onClose?: () => void;
};

function BroadcastMedia({
  eventRef,
  hasBroadcast,
  streamUrl,
  streamType,
  error,
  videoRef,
  needsTap,
  onTapPlay,
}: {
  eventRef: string;
  hasBroadcast?: boolean;
  streamUrl: string | null;
  streamType: string | null;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  needsTap?: boolean;
  onTapPlay?: () => void;
}) {
  if (streamUrl && streamType === "iframe") {
    return (
      <iframe
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        className={styles.broadcastVideo}
        referrerPolicy="no-referrer-when-downgrade"
        src={streamUrl}
        title={`Трансляция ${eventRef}`}
      />
    );
  }

  if (streamUrl) {
    return (
      <div className={styles.videoShell}>
        <video
          ref={videoRef}
          autoPlay
          className={styles.broadcastVideo}
          controls
          muted
          playsInline
        />
        {needsTap && (
          <button className={styles.tapPlayBtn} onClick={onTapPlay} type="button">
            Смотреть трансляцию
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.broadcastPlaceholder}>
      <span className={styles.broadcastBadge}>LIVE</span>
      <p>{error ?? "Видеотрансляция матча"}</p>
    </div>
  );
}

export function WcBroadcastPlayer({
  eventRef,
  hasBroadcast,
  meta,
  variant = "default",
  showClose = false,
  onClose,
}: WcBroadcastPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string | null>(null);
  const [available, setAvailable] = useState(Boolean(hasBroadcast));
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsTap(false);
    void video.play().catch(() => setNeedsTap(true));
  }, []);

  const loadStreamUrl = useCallback(async () => {
    try {
      const payload = await fetchWcEventBroadcast(eventRef);
      setAvailable(payload.available);
      setStreamUrl(payload.streamUrl);
      setStreamType(payload.streamType);
      if (payload.available && !payload.streamUrl) {
        setError("Трансляция доступна, поток подключается…");
      } else if (payload.streamUrl) {
        setError(null);
      }
      return payload.streamUrl;
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

  if (!hasBroadcast && !available) return null;

  const media = (
    <BroadcastMedia
      error={error}
      eventRef={eventRef}
      hasBroadcast={hasBroadcast}
      needsTap={needsTap}
      onTapPlay={tryPlay}
      streamType={streamType}
      streamUrl={streamUrl}
      videoRef={videoRef}
    />
  );

  if (variant === "sidebar") {
    return (
      <div className={styles.broadcastCard}>
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
