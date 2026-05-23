import Image, { StaticImageData } from "next/image";

import { Button } from "~/shared/ui";

import styles from "./SystemSelect.module.css";

type SystemSelectProps = {
  formName: string;
  icons: (
    | React.FC<React.SVGProps<SVGElement> & Record<string, string>>
    | StaticImageData
  )[];
  paymentSystem: null | string;
  setPaymentSystem: React.Dispatch<React.SetStateAction<null | string>>;
  text: string;
};

export const SystemSelect: React.FC<SystemSelectProps> = ({
  formName,
  icons,
  paymentSystem,
  setPaymentSystem,
  text,
}) => {
  return (
    <Button
      className={`${styles.SystemSelect} ${paymentSystem === formName && styles.systemSelect_active}`}
      onClick={() => setPaymentSystem(formName)}
    >
      <div className={styles.icons}>
        {icons.map((Icon, index) =>
          typeof Icon === "object" ? (
            <Image alt="Payment method" key={index} src={Icon} />
          ) : (
            <Icon className={styles.systemSelectIcon} key={`${index}`} />
          ),
        )}
      </div>
      <p className={styles.systemSelectTextMini}>{text}</p>
    </Button>
  );
};
