import { z } from 'zod';

import type {
  OlimpbetCyberEventDetail,
  OlimpbetCyberEventListItem,
  OlimpbetCyberEventListResponse,
  OlimpbetCyberTournamentListItem,
  OlimpbetCyberTournamentListResponse,
} from '../cybersport/cybersport.types';
import type {
  OlimpbetEventDetail,
  OlimpbetV2EventListItem,
  OlimpbetV2EventListResponse,
} from './olimpbet-wc.types';

const CompetitorSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
}).passthrough();

const ListItemCoreSchema = z.object({
  id: z.coerce.number().int().positive(),
  eventDate: z.string().min(1),
  live: z.boolean().optional(),
  competitors: z.array(CompetitorSchema).optional().nullable(),
  homeCompetitorIds: z.array(z.coerce.number()).optional().nullable(),
  eventType: z.object({ code: z.string().optional().nullable() }).passthrough().optional().nullable(),
  tournament: z.object({
    id: z.coerce.number().optional(),
    name: z.string().optional().nullable(),
    sportId: z.coerce.number().optional(),
  }).passthrough().optional().nullable(),
  status: z.string().optional().nullable(),
  tags: z.array(z.union([z.number(), z.string()])).optional().nullable(),
}).passthrough();

const ProbabilitySchema = z.object({
  outcomeTypeId: z.coerce.number(),
  odd: z.coerce.number().optional().nullable(),
  suspended: z.boolean().optional().nullable(),
  tradingStatus: z.string().optional().nullable(),
  parameters: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).optional().nullable(),
}).passthrough();

const EventDetailCoreSchema = z.object({
  id: z.coerce.number().int().positive(),
  eventDate: z.string().min(1),
  competitors: z.array(CompetitorSchema).min(2),
  probabilities: z.object({
    eventId: z.coerce.number().optional(),
    markets: z.array(z.object({
      marketId: z.coerce.number(),
      probabilities: z.array(ProbabilitySchema).optional(),
    }).passthrough()).optional(),
  }).passthrough().optional().nullable(),
}).passthrough();

const PaginationEnvelopeSchema = z.object({
  paginationKey: z.string().nullable().optional(),
  paginationKeyForward: z.string().nullable().optional(),
  paginationKeyBackward: z.string().nullable().optional(),
}).passthrough();

function filterValidItems<T>(
  raw: unknown,
  itemSchema: z.ZodTypeAny,
): T[] {
  if (!raw || typeof raw !== 'object' || !('items' in raw)) return [];
  const items = (raw as { items?: unknown[] }).items;
  if (!Array.isArray(items)) return [];

  const valid: T[] = [];
  for (const item of items) {
    const parsed = itemSchema.safeParse(item);
    if (parsed.success) {
      valid.push(parsed.data as T);
    }
  }
  return valid;
}

export function parseOlimpbetV2EventListResponse(
  raw: unknown,
): OlimpbetV2EventListResponse | null {
  const envelope = PaginationEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return null;

  const items = filterValidItems<OlimpbetV2EventListItem>(raw, ListItemCoreSchema);
  return {
    ...envelope.data,
    items,
  };
}

export function parseOlimpbetEventDetail(raw: unknown): OlimpbetEventDetail | null {
  const result = EventDetailCoreSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data as OlimpbetEventDetail;
}

export function parseOlimpbetCyberEventListResponse(
  raw: unknown,
): OlimpbetCyberEventListResponse | null {
  const envelope = PaginationEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return null;

  const items = filterValidItems<OlimpbetCyberEventListItem>(raw, ListItemCoreSchema);
  return {
    ...envelope.data,
    items,
  };
}

export function parseOlimpbetCyberEventDetail(
  raw: unknown,
): OlimpbetCyberEventDetail | null {
  const CyberEventDetailSchema = z.object({
    id: z.coerce.number().int().positive(),
    eventDate: z.string().min(1),
    competitors: z.array(CompetitorSchema).min(1),
    probabilities: z.object({
      markets: z.array(z.object({
        marketId: z.coerce.number(),
        probabilities: z.array(ProbabilitySchema).optional(),
      }).passthrough()).optional(),
    }).passthrough().optional().nullable(),
  }).passthrough();

  const result = CyberEventDetailSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data as OlimpbetCyberEventDetail;
}

const TournamentItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().optional(),
  sportId: z.coerce.number().optional(),
  liveEventCount: z.coerce.number().optional(),
  lineEventCount: z.coerce.number().optional(),
  tags: z.array(z.union([z.number(), z.string()])).optional().nullable(),
}).passthrough();

export function parseOlimpbetCyberTournamentListResponse(
  raw: unknown,
): OlimpbetCyberTournamentListResponse | null {
  const envelope = PaginationEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return null;

  const items = filterValidItems<OlimpbetCyberTournamentListItem>(raw, TournamentItemSchema);
  return {
    ...envelope.data,
    items,
  };
}

/** Statistics endpoint — accept any object without `errors` key. */
export function parseOlimpbetStatistics<T extends object>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null;
  if ('errors' in (raw as object)) return null;
  return raw as T;
}
