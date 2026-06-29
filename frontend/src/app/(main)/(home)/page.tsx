import { Header } from "~/widgets/Header";

import { HomeDeferredSections } from "./HomeDeferredSections";
import styles from "./Home.module.css";

export default function Home() {
  return (
    <>
      <Header className={styles.header} />
      <HomeDeferredSections />
    </>
  );
}
