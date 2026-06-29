import type { WcEvent } from "~/entities/wc-odds/api/client";

export function wcEventPriorityLevel(event: Pick<WcEvent, "priorityLevel" | "isPriority">): number {
  if (event.priorityLevel != null) return event.priorityLevel;
  return event.isPriority ? 1 : 0;
}

export function isWcPriorityEvent(event: Pick<WcEvent, "priorityLevel" | "isPriority">): boolean {
  return wcEventPriorityLevel(event) > 0;
}

export function compareWcEventPriority(
  a: Pick<WcEvent, "priorityLevel" | "isPriority">,
  b: Pick<WcEvent, "priorityLevel" | "isPriority">,
): number {
  return wcEventPriorityLevel(b) - wcEventPriorityLevel(a);
}

export function sortWcEventsByPriority(events: WcEvent[]): WcEvent[] {
  return [...events].sort((a, b) => {
    const priorityDelta = compareWcEventPriority(a, b);
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
  });
}

export function maxWcEventsPriorityLevel(events: Array<Pick<WcEvent, "priorityLevel" | "isPriority">>): number {
  return events.reduce((max, event) => Math.max(max, wcEventPriorityLevel(event)), 0);
}
