import { Header } from "~/widgets/Header";

import styles from "./Home.module.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header className={styles.header} />
      {children}
    </>
  );
}
