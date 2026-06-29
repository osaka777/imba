'use client';

import { useEffect, useState } from 'react';

import {
  fetchPromoModalSettings,
  type PublicPromoModalSettings,
} from '~/entities/promo-modal/api/client';

let cached: PublicPromoModalSettings | null | undefined;

export function usePromoModalSettings() {
  const [settings, setSettings] = useState<PublicPromoModalSettings | null>(
    cached ?? null,
  );
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (cached !== undefined) {
      setSettings(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchPromoModalSettings().then((data) => {
      if (cancelled) return;
      cached = data;
      setSettings(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading, enabled: settings?.enabled === true };
}

export function invalidatePromoModalSettingsCache() {
  cached = undefined;
}
