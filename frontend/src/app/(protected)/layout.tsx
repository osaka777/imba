"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyUser } from "~/entities/user/api/verifyUser";
import "~/shared/ui/styles/index.css";

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isLoggedIn = await verifyUser();
        
        if (!isLoggedIn) {
          console.log('ProtectedLayout: User not authenticated, redirecting to home');
          router.push("/");
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('ProtectedLayout: Error checking authentication:', error);
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '16px',
        color: 'var(--blue-70)'
      }}>
        Проверка авторизации...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Редирект уже произошел
  }

  return <div>{children}</div>;
}
