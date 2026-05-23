import styles from "./forms/NirvanaPayForm.module.css";

type DepositFormHeadingProps = {
  subtitle?: string;
  title?: string;
};

export const DepositFormHeading = ({
  title = "Пополнение",
  subtitle,
}: DepositFormHeadingProps) => {
  if (!subtitle) {
    return <h2 className={styles.heading}>{title}</h2>;
  }

  return (
    <div className={styles.headingGroup}>
      <h2 className={styles.heading}>{title}</h2>
      <p className={styles.headingSubline}>{subtitle}</p>
    </div>
  );
};
