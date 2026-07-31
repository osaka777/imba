import { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import { WindowsDownloadClient } from "./WindowsDownloadClient";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoWindowsTitle", {
    descriptionKey: "common.seoWindowsDesc",
    path: "/windows",
  });
}

export default function WindowsDownloadPage() {
  return <WindowsDownloadClient />;
}
