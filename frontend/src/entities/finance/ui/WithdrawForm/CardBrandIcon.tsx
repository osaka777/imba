import {
  LockIcon,
  MastercardIcon,
  MirLogoIcon,
  VisaIcon,
} from "~/shared/assets";

import type { CardBrand } from "~/shared/lib/cardNumber";

import styles from "./BovaForm.module.css";

type CardBrandIconProps = {
  brand: CardBrand;
};

const brandIconProps = {
  "aria-hidden": true,
  "data-card-brand": true,
  className: styles.cardBrandIcon,
} as const;

export const CardBrandIcon = ({ brand }: CardBrandIconProps) => {
  switch (brand) {
    case "visa":
      return <VisaIcon {...brandIconProps} />;
    case "mastercard":
      return <MastercardIcon {...brandIconProps} />;
    case "mir":
      return <MirLogoIcon {...brandIconProps} />;
    default:
      return <LockIcon aria-hidden className={styles.cardBrandIconFallback} />;
  }
};
