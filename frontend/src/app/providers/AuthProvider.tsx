'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { verifyUser } from "~/entities/user/api";
import { syncAccessTokenCookie } from "~/entities/user/lib/syncAccessTokenCookie";

interface AuthContextType {
  isAuth: boolean;
}

const AuthContext = createContext<AuthContextType>({ isAuth: false });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    verifyUser().then((result) => {
      if (result) syncAccessTokenCookie();
      if (mounted) setIsAuth(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 