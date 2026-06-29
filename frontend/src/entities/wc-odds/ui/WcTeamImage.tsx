"use client";

import Image from "next/image";
import { useState } from "react";

import { wcCompetitorIconUrl } from "~/entities/wc-odds/lib/wcCompetitorIcon";
import { WcNationalFlag } from "~/entities/wc-odds/ui/WcNationalFlag";

type WcTeamImageProps = {
  teamName: string;
  iconUrl?: string | null;
  competitorId?: number | null;
  size?: number;
  rounded?: boolean;
};

export function WcTeamImage({
  teamName,
  iconUrl,
  competitorId,
  size = 40,
  rounded = false,
}: WcTeamImageProps) {
  const crestUrl = wcCompetitorIconUrl(competitorId, iconUrl);
  const [failed, setFailed] = useState(false);

  if (!crestUrl || failed) {
    return <WcNationalFlag rounded={rounded} teamName={teamName} size={size} />;
  }

  return (
    <div
      className={`relative overflow-hidden shrink-0 ${rounded ? "rounded-full" : ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={crestUrl}
        alt={teamName}
        width={size}
        height={size}
        className={rounded ? "object-cover w-full h-full" : "object-contain w-auto h-auto"}
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}
