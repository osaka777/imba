"use client";

import { useEffect, useState } from "react";

import {
  getKickoffCountdownParts,
  type KickoffCountdownParts,
} from "~/entities/wc-odds/lib/wcKickoffCountdown";

export function useKickoffCountdown(commenceTime: string): KickoffCountdownParts {
  const [parts, setParts] = useState(() => getKickoffCountdownParts(commenceTime));

  useEffect(() => {
    setParts(getKickoffCountdownParts(commenceTime));

    const tick = () => setParts(getKickoffCountdownParts(commenceTime));
    const id = window.setInterval(tick, 1000);

    return () => window.clearInterval(id);
  }, [commenceTime]);

  return parts;
}
