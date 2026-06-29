"use client";

import { Component, type ReactNode, useEffect, useState } from "react";

import {
  fetchHomepageWidgets,
  type HomepageWidgetItem,
} from "~/entities/wc-odds/api/client";
import { WcTopEventCard } from "~/entities/wc-odds/ui/WcTopEventCard";
import { HOMEPAGE_TOP_EVENTS_TOTAL } from "~/entities/wc-odds/ui/topEventsUtils";
import type { TopEventItem } from "~/entities/wc-odds/ui/topEventsUtils";

import styles from "~/entities/wc-odds/ui/WcTopEventsSection.module.css";

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

  useEffect(() => {
    let cancelled = false;

    void fetchHomepageWidgets()
      .then((payload) => {
        if (cancelled) return;
        setItems(toTopEventItems(payload.items));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section aria-label="Топ события" className={styles.section}>
      <div className={styles.track}>
        {loading
          ? Array.from({ length: HOMEPAGE_TOP_EVENTS_TOTAL }).map((_, index) => (
              <div aria-hidden className={styles.skeleton} key={index} />
            ))
          : items.map((item) => <WcTopEventCard item={item} key={item.key} />)}
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
