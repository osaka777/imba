import styles from "./LoadingScreen.module.css";
import { LoadingSpiner } from "./LoadingSpiner";

type LoadingScreenProps = {
    className?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ className }) => {
    return (
        <div className={`${styles.LoadingScreen} ${className}`}>
            <LoadingSpiner />
            <p className={styles.text}>{`Загрузка...`}</p>
        </div>
    );
};
