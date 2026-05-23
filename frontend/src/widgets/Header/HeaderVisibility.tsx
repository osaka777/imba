"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Header } from "~/widgets/Header";
import stylesHome from "~/app/(main)/Home.module.css";

export function HeaderVisibility() {
  const pathname = usePathname();
  const hide = pathname?.startsWith("/game/") === true;
  if (hide) return null;
  return (
    <Suspense fallback={null}>
      <Header className={stylesHome.header} />
    </Suspense>
  );
}
