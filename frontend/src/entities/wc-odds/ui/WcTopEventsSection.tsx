"use client";

import { Component, type ReactNode, useCallback, useEffect, useState } from "react";

import { useSocialPulse } from "~/entities/social-pulse/lib/useSocialPulse";
import {
  fetchHomepageWidgets,
  type HomepageWidgetItem,
} from "~/entities/wc-odds/api/client";
import { WcTopEventCard } from "~/entities/wc-odds/ui/WcTopEventCard";
import { HOMEPAGE_TOP_EVENTS_TOTAL } from "~/entities/wc-odds/ui/topEventsUtils";
import type { TopEventItem } from "~/entities/wc-odds/ui/topEventsUtils";
import { useLocale } from "~/shared/model/useLocale";

import styles from "~/entities/wc-odds/ui/WcTopEventsSection.module.css";

const WIDGETS_POLL_MS = 20_000;

type TopEventsErrorBoundaryProps = {
  children: ReactNode;
};

type TopEventsErrorBoundaryState = {
  hasError: boolean;
};

class TopEventsErrorBoundary extends Component<TopEventsErrorBoundaryProps, TopEventsErrorBoundaryState> {
  state: TopEventsErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): TopEventsErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[WcTopEventsSection]", error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function toTopEventItems(items: HomepageWidgetItem[]): TopEventItem[] {
  return items.map((item) => {
    if (item.kind === "wc") {
      return { kind: "wc", key: item.event.id, event: item.event };
    }
    return {
      kind: "cyber",
      key: item.event.eventId,
      event: item.event,
      isLive: item.isLive,
    };
  });
}

function WcTopEventsSectionInner() {
  const [items, setItems] = useState<TopEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pulseByEventId = useSocialPulse();
  const { t } = useLocale();

  const loadWidgets = useCallback(async (initial = false) => {
    try {
      const payload = await fetchHomepageWidgets();
      setItems(toTopEventItems(payload.items));
    } catch {
      if (initial) setItems([]);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadWidgets(true);
      if (cancelled) return;
    })();

    const timer = setInterval(() => {
      void loadWidgets(false);
    }, WIDGETS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadWidgets]);

  if (!loading && items.length === 0) return null;

  return (
    <section aria-label={t("home.topEvents")} className={styles.section}>
      <div className={styles.track}>
        {loading
          ? Array.from({ length: HOMEPAGE_TOP_EVENTS_TOTAL }).map((_, index) => (
              <div aria-hidden className={styles.skeleton} key={index} />
            ))
          : items.map((item) => (
              <WcTopEventCard
                item={item}
                key={item.key}
                pulse={item.kind === "wc" ? pulseByEventId.get(item.event.id) : undefined}
              />
            ))}
      </div>
    </section>
  );
}

export function WcTopEventsSection() {
  return (
    <TopEventsErrorBoundary>
      <WcTopEventsSectionInner />
    </TopEventsErrorBoundary>
  );
}
