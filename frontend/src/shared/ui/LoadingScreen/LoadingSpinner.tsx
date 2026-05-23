import clsx from "clsx";
import Image from "next/image";

import { FaviconImage } from "~/shared/assets";

import styles from "./LoadingSpinner.module.css";

type Props = {
  className?: string;
};

export const LoadingSpinner = ({ className }: Props) => {
  return (
    <Image
      alt="Загрузка..."
      className={clsx(styles.LoadingSpinner, className)}
      src={FaviconImage}
    />
  );
};
