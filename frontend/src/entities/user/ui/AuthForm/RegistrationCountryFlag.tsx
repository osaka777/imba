import { getCountryFlagUrl } from "~/entities/user/lib/registrationCountries";

import styles from "./RegistrationFields.module.css";

type RegistrationCountryFlagProps = {
  code: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function RegistrationCountryFlag({
  code,
  className,
  size = "md",
}: RegistrationCountryFlagProps) {
  return (
    <span
      aria-hidden
      className={[
        styles.flagWrap,
        size === "sm"
          ? styles.flagWrap_sm
          : size === "lg"
            ? styles.flagWrap_lg
            : styles.flagWrap_md,
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
        src={getCountryFlagUrl(code)}
      />
    </span>
  );
}
