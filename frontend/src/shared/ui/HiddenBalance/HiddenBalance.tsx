import styles from "./HiddenBalance.module.css";

type HiddenBalanceProps = {
  className?: string;
  /** Number of mask characters. Default 4. */
  length?: number;
};

/** Bookmaker-style masked balance — typographic, inherits parent size/weight. */
export function HiddenBalance({ className, length = 4 }: HiddenBalanceProps) {
  const count = Math.max(3, Math.min(length, 6));
  const mask = "∗".repeat(count);

  return (
    <span className={`${styles.root} ${className ?? ""}`} aria-label="скрыто">
      {mask}
    </span>
  );
}
