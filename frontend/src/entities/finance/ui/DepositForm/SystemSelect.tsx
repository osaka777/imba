import Image, { StaticImageData } from "next/image";

import { Button } from "~/shared/ui";

import styles from "./SystemSelect.module.css";

type SystemSelectVariant = "default" | "kaspi" | "sberbank" | "yandex";

type SystemSelectProps = {
  formName: string;
  icons: (
    | React.FC<React.SVGProps<SVGElement> & Record<string, string>>
    | StaticImageData
    | string
  )[];
  paymentSystem: null | string;
  setPaymentSystem: React.Dispatch<React.SetStateAction<null | string>>;
  text: string;
  variant?: SystemSelectVariant;
};

export const SystemSelect: React.FC<SystemSelectProps> = ({
  formName,
  icons,
  paymentSystem,
  setPaymentSystem,
  text,
  variant = "default",
}) => {
  const brandVariant =
    variant === "kaspi" || variant === "sberbank" || variant === "yandex" ? variant : null;

  return (
    <Button
      className={`${styles.SystemSelect}${brandVariant ? ` ${styles[`SystemSelect_${brandVariant}`]}` : ""} ${paymentSystem === formName && styles.systemSelect_active}`}
      onClick={() => setPaymentSystem(formName)}
    >
      <div className={`${styles.icons}${brandVariant ? ` ${styles[`icons_${brandVariant}`]}` : ""}`}>
        {icons.map((Icon, index) =>
          typeof Icon === "string" ? (
            <Image
              alt={text}
              className={brandVariant ? styles[`${brandVariant}Logo`] : undefined}
              height={36}
              key={index}
              src={Icon}
              width={120}
            />
          ) : typeof Icon === "object" && Icon !== null && "src" in Icon ? (
            <Image
              alt="Payment method"
              className={brandVariant ? styles[`${brandVariant}Logo`] : undefined}
              key={index}
              src={Icon}
            />
          ) : typeof Icon === "function" ? (
            <Icon className={styles.systemSelectIcon} key={`${index}`} />
          ) : null,
        )}
      </div>
      <p className={styles.systemSelectTextMini}>{text}</p>
    </Button>
  );
};
