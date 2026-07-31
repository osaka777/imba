import type { CyberGame } from "~/entities/cybersport/api/client";

type CyberVideoMeta = {
  hasBroadcast?: boolean;
  kickChannel?: string;
  oneWinBroadcastUrl?: string;
  streamProvider?: string;
  twitchChannel?: string;
  wcHasBroadcast?: boolean;
};

/** Prefer 1win streams only — Kick/Twitch are not match video (partners use attribution UI). */
export function cyberGameHasVideo(
  game: Pick<CyberGame, "meta"> | null | undefined,
): boolean {
  const meta = (game?.meta ?? {}) as CyberVideoMeta;
  if (meta.oneWinBroadcastUrl) return true;
  if (meta.streamProvider === "onewin") return true;
  // Backend only sets hasBroadcast when a real 1win stream URL exists.
  if (meta.hasBroadcast || meta.wcHasBroadcast) {
    if (meta.streamProvider === "kick" || meta.streamProvider === "twitch") {
      return false;
    }
    if (meta.kickChannel || meta.twitchChannel) return false;
    return true;
  }
  return false;
}
