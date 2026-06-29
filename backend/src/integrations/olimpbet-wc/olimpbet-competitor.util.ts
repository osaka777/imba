import type { OlimpbetEventDetail } from './olimpbet-wc.types';

export type OlimpbetCompetitorMeta = {
  homeCompetitorId: number | null;
  awayCompetitorId: number | null;
  homeTeamIcon: string | null;
  awayTeamIcon: string | null;
  hasBroadcast: boolean;
};

export function resolveOlimpbetCompetitorIds(
  detail: Pick<OlimpbetEventDetail, 'competitors' | 'homeCompetitorIds'>,
): { homeId: number | null; awayId: number | null } {
  const comps = detail.competitors ?? [];
  if (comps.length < 2) {
    return { homeId: null, awayId: null };
  }

  const homeCompetitorId = (detail.homeCompetitorIds ?? [])[0];
  const home = comps.find((c) => c.id === homeCompetitorId) ?? comps[0];
  const away = comps.find((c) => c.id !== home?.id) ?? comps[1];

  return {
    homeId: home?.id ?? null,
    awayId: away?.id ?? null,
  };
}

export function isOlimpbetBroadcastAvailable(
  detail: Pick<OlimpbetEventDetail, 'broadcastAvailability' | 'broadcastAvailabilityStatus'>,
): boolean {
  const status = detail.broadcastAvailabilityStatus
    ?? detail.broadcastAvailability?.status
    ?? '';
  return String(status).toUpperCase() === 'AVAILABLE';
}

export function buildOlimpbetCompetitorMeta(
  detail: Pick<
    OlimpbetEventDetail,
    'competitors' | 'homeCompetitorIds' | 'broadcastAvailability' | 'broadcastAvailabilityStatus'
  >,
): OlimpbetCompetitorMeta {
  const { homeId, awayId } = resolveOlimpbetCompetitorIds(detail);

  return {
    homeCompetitorId: homeId,
    awayCompetitorId: awayId,
    homeTeamIcon: null,
    awayTeamIcon: null,
    hasBroadcast: isOlimpbetBroadcastAvailable(detail),
  };
}
