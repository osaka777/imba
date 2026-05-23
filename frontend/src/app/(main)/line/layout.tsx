import { Header } from "~/widgets/Header";
import styles from './layout.module.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header className={styles.header} />
      <div className={styles.container}>
        {children}
      </div>
    </>
  );
}
