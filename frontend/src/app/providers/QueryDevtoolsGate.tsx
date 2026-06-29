"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryDevtoolsGate() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <ReactQueryDevtools />;
}
