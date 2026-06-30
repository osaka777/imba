import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useGamesBettingContext } from '~/app/providers/GamesBetting.provider';
import { getMyWcBets } from '~/entities/wc-odds/api/getMyWcBets';

/** Poll pending WC bets and refresh balance when a bet settles (WS fallback). */
export const useWcBetSettlementSync = () => {
  const { isAuth } = useGamesBettingContext();
  const queryClient = useQueryClient();
  const prevIdsRef = useRef<Set<number>>(new Set());
  const hadPendingRef = useRef(false);

  useEffect(() => {
    if (!isAuth) return;

    const interval = setInterval(async () => {
      try {
        const pending = await getMyWcBets('PENDING');
        const currentIds = new Set(pending.map((bet) => bet.id));

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
        hadPendingRef.current = pending.length > 0;
      } catch {
        // ignore transient fetch errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAuth, queryClient]);
};
