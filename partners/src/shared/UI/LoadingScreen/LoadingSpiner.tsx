import { FaviconImage } from "@/shared/assets";
import Image from "next/image";
import styles from "./LoadingSpiner.module.css";

type LoadingSpinerProps = {
    className?: string;
};

export const LoadingSpiner: React.FC<LoadingSpinerProps> = ({ className }) => {
    return <Image className={`${styles.LoadingSpiner} ${className}`} src={FaviconImage} alt="Загрузка..." />;
};
