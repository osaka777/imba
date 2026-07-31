import type { Metadata } from "next";

import { Header } from "~/widgets/Header";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import { HomeDeferredSections } from "./HomeDeferredSections";
import styles from "./Home.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoSiteTitle", {
    descriptionKey: "common.seoHomeDesc",
    path: "/",
  });
}

export default function Home() {
  return (
    <>
      <Header className={styles.header} />
      <HomeDeferredSections />
    </>
  );
}
