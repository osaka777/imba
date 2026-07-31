import type { Metadata } from "next";

import { WcLinePage } from "~/entities/wc-odds/ui/WcLinePage";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import styles from "../line/layout.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoWcLine");
}

export default function WorldCupLinePage() {
  return (
    <div className={styles.games}>
      <WcLinePage />
    </div>
  );
}
