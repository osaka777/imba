"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { useBetNotifications } from "~/entities/bet/lib/useBetNotifications";
import { useAuth } from "./AuthProvider";

type GamesBettingContextType = {
  isAuth: boolean;
};

const GamesBettingContext = createContext<GamesBettingContextType | undefined>(
  undefined,
);

export const GamesBettingProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { isAuth } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <GamesBettingContext.Provider
      value={{
        isAuth,
      }}
    >
      <BetNotificationsWrapper>
        {mounted ? children : null}
      </BetNotificationsWrapper>
    </GamesBettingContext.Provider>
  );
};

// Компонент-обёртка для уведомлений о ставках
const BetNotificationsWrapper = ({ children }: { children: ReactNode }) => {
  useBetNotifications();
  return <>{children}</>;
};

export const useGamesBettingContext = () => {
  const gamesBettingContext = useContext(GamesBettingContext);
  if (!gamesBettingContext) {
    throw new Error(
      "No GamesBettingContext.Provider found when calling useGamesBettingContext",
    );
  }
  return gamesBettingContext;
};
