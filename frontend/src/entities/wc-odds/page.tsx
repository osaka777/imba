import { Metadata } from "next";

import { WcLinePage } from "~/entities/wc-odds/ui/WcLinePage";
import { makeMetadata } from "~/shared/lib";

import styles from "../line/layout.module.css";

export const metadata: Metadata = makeMetadata("ЧМ — линия");

export default function WorldCupLinePage() {
  return (
    <div className={styles.games}>
      <WcLinePage />
    </div>
  );
}
