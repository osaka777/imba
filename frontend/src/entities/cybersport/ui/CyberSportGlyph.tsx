"use client";

import { useState } from "react";

import { useCyberSportIconUrl } from "~/entities/cybersport/hooks/useCybersportDisciplines";
import { cyberIconForApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { cn } from "~/shared/lib";

import styles from "./CyberSportGlyph.module.css";

type CyberSportGlyphProps = {
  apiSport: string;
  label?: string;
  className?: string;
  size?: number;
  /** Override API icon (e.g. SSR). When omitted, loads from /api/cybersport/disciplines. */
  iconUrl?: string | null;
};

/** Discipline mark — prefers 1win sport icon, falls back to local SVG. */
export function CyberSportGlyph({
  apiSport,
  label = "",
  className,
  size = 18,
  iconUrl: iconUrlProp,
}: CyberSportGlyphProps) {
  const iconFromApi = useCyberSportIconUrl(apiSport);
  const iconUrl = iconUrlProp ?? iconFromApi;
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = cyberIconForApiSport(apiSport);

  if (iconUrl && !imgFailed) {
    return (
      <span
        aria-label={label || undefined}
        className={cn(styles.wrap, styles.wrap_image, className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className={styles.img}
          decoding="async"
          height={size}
          loading="lazy"
          onError={() => setImgFailed(true)}
          src={iconUrl}
          width={size}
        />
      </span>
    );
  }

  return (
    <span
      aria-label={label || undefined}
      className={cn(styles.wrap, className)}
      style={{ width: size, height: size }}
    >
      <Icon className={styles.svg} />
    </span>
  );
}
