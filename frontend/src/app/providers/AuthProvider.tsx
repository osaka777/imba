'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { verifyUser } from "~/entities/user/api";

interface AuthContextType {
  isAuth: boolean;
}

const AuthContext = createContext<AuthContextType>({ isAuth: false });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    verifyUser().then((result) => {
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