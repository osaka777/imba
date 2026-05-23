"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare const ym: any;

export default function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = `${pathname}?${searchParams}`;
    ym(98703324, "hit", url);
  }, [pathname, searchParams]);

  return null;
}
