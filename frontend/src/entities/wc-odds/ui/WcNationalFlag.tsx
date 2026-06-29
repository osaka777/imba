"use client";

import Image from "next/image";
import { useState } from "react";

import { getWcTeamFlagUrl } from "~/entities/wc-odds/lib/wcTeamFlags";

type WcNationalFlagProps = {
  teamName: string;
  size?: number;
  rounded?: boolean;
};

export function WcNationalFlag({ teamName, size = 64, rounded = false }: WcNationalFlagProps) {
  const flagUrl = getWcTeamFlagUrl(teamName);
  const [failed, setFailed] = useState(false);

  if (!flagUrl || failed) {
    return (
      <div
        className={`bg-white/10 border border-white/20 ${rounded ? "rounded-full" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${rounded ? "rounded-full" : ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={flagUrl}
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
