import styles from "./LoadingScreen.module.css";
import { LoadingSpinner } from "./LoadingSpinner";

type LoadingScreenProps = {
  className?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ className }) => {
  return (
    <div className={`${styles.LoadingScreen} ${className}`}>
      <LoadingSpinner />
      <p className={styles.text}>{`Загрузка...`}</p>
    </div>
  );
};
