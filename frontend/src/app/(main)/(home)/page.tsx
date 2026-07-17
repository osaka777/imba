import { Header } from "~/widgets/Header";

import { HomeDeferredSections } from "./HomeDeferredSections";
import styles from "./Home.module.css";
import { makeMetadata } from "~/shared/lib";

export const metadata = makeMetadata(undefined, {
  description:
    "Imba.bet — букмекер со ставками live и линией на футбол, теннис и киберспорт. Минимальный депозит от 500 ₸, пополнение Kaspi и USDT.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <Header className={styles.header} />
      <HomeDeferredSections />
    </>
  );
}
