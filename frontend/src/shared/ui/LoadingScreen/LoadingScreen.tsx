import Image from "next/image";

import { LogoWhiteIcon } from "~/shared/assets";

import styles from "./LoadingScreen.module.css";

type LoadingScreenProps = {
  className?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ className }) => {
  return (
    <div className={`${styles.LoadingScreen}${className ? ` ${className}` : ""}`}>
      <div className={styles.stack}>
        <Image
          alt="Imba.bet"
          className={styles.logo}
          height={40}
          priority
          src={LogoWhiteIcon}
          width={168}
        />
        <span className={styles.ring} aria-hidden />
      </div>
    </div>
  );
};
