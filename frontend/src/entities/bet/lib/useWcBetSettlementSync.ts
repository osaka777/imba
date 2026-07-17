import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useGamesBettingContext } from '~/app/providers/GamesBetting.provider';
import { getMyWcBetsGrouped } from '~/entities/wc-odds/api/getMyWcBets';

const SETTLEMENT_POLL_MS = 15_000;

/** Poll pending WC bets and refresh balance when a bet settles (WS fallback). */
export const useWcBetSettlementSync = () => {
  const { isAuth } = useGamesBettingContext();
  const queryClient = useQueryClient();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const hadPendingRef = useRef(false);

  useEffect(() => {
    if (!isAuth) return;

    const poll = async () => {
      if (document.hidden) return;

      try {
        const grouped = await getMyWcBetsGrouped('PENDING');
        const currentIds = new Set<string>([
          ...grouped.ordinar.map((bet) => `o-${bet.id}`),
          ...grouped.express.map((bet) => `e-${bet.id}`),
        ]);

        if (hadPendingRef.current) {
          const settled = [...prevIdsRef.current].some((id) => !currentIds.has(id));
          if (settled) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['user'] }),
              queryClient.invalidateQueries({ queryKey: ['wc-bets'] }),
              queryClient.invalidateQueries({ queryKey: ['bets', 'open'] }),
            ]);
          }
        }

        prevIdsRef.current = currentIds;
        hadPendingRef.current = currentIds.size > 0;
      } catch {
        // ignore transient fetch errors
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), SETTLEMENT_POLL_MS);

    return () => clearInterval(interval);
  }, [isAuth, queryClient]);
};
