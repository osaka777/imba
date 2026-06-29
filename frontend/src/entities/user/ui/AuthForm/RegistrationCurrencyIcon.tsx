import { getCurrencyIconUrl } from "~/entities/user/lib/registrationCountries";

import styles from "./RegistrationFields.module.css";

type RegistrationCurrencyIconProps = {
  isoCode: string;
  className?: string;
  size?: "sm" | "md";
};

export function RegistrationCurrencyIcon({
  isoCode,
  className,
  size = "md",
}: RegistrationCurrencyIconProps) {
  return (
    <span
      aria-hidden
      className={[
        styles.flagWrap,
        size === "sm" ? styles.flagWrap_sm : styles.flagWrap_md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        alt=""
        className={styles.flagImg}
        decoding="async"
        draggable={false}
        loading="lazy"
        src={getCurrencyIconUrl(isoCode)}
      />
    </span>
  );
}
