"use client";

import { useEffect } from "react";

export function WidgetChrome() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    const prevMargin = body.style.margin;

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.margin = "0";

    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
      body.style.margin = prevMargin;
    };
  }, []);

  return null;
}
