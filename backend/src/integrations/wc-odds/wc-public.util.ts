import type { WcOddsEventDetailDto, WcOddsEventDto } from './wc-odds.types';
import { isWcEventId, olimpbetIdFromWcEventId } from './wc-slug.util';
import { stripJunkSpecialtyGroupedMarkets } from '../olimpbet-wc/olimpbet-wc-market-keys.util';

/** XOR mask for public event ids (internal ol-{n} never leaves the server). */
const ID_XOR = 0x5a3c9f12;

export function toPublicEventId(internalId: string): string {
  const olId = olimpbetIdFromWcEventId(internalId);
  if (olId == null) return internalId;
  return `m${(olId ^ ID_XOR).toString(36)}`;
}

export function publicIdToInternal(publicId: string): string | null {
  if (!/^m[a-z0-9]+$/i.test(publicId)) return null;
  const olId = parseInt(publicId.slice(1), 36) ^ ID_XOR;
  if (!Number.isFinite(olId) || olId <= 0) return null;
  return `ol-${olId}`;
}

/** Resolve a client ref (public id, legacy ol-id, or slug) for DB lookup. */
export function resolveEventRef(ref: string): string {
  const decoded = decodeURIComponent(ref).trim();
  const fromPublic = publicIdToInternal(decoded);
  if (fromPublic) return fromPublic;
  return decoded;
}

export function isResolvableEventRef(ref: string): boolean {
  const decoded = decodeURIComponent(ref).trim();
  return isWcEventId(decoded) || /^m[a-z0-9]+$/i.test(decoded);
}

export function toPublicRef(dto: { id: string; slug?: string | null }): string {
  return dto.slug?.trim() || toPublicEventId(dto.id);
}

export function sanitizePublicEventDto<T extends WcOddsEventDto>(dto: T): T {
  const out = { ...dto } as T & { olimpbetEventId?: unknown };
  delete out.olimpbetEventId;
  out.id = toPublicEventId(dto.id);
  out.bookmaker = '';
  return out as T;
}

export function sanitizePublicEventDetail(dto: WcOddsEventDetailDto): WcOddsEventDetailDto {
  const out = sanitizePublicEventDto(dto);
  if (out.groupedMarkets) {
    out.groupedMarkets = stripJunkSpecialtyGroupedMarkets(out.groupedMarkets);
  }
  return out;
}

export function sanitizePublicEventList(dtos: WcOddsEventDto[]): WcOddsEventDto[] {
  return dtos.map(sanitizePublicEventDto);
}
