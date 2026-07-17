import styles from "./KickLogoMark.module.css";

type Props = {
  className?: string;
};

/** Минимальный зелёный wordmark Kick — только лого, без брендинга блока. */
export function KickLogoMark({ className }: Props) {
  return (
    <span
      className={[styles.mark, className].filter(Boolean).join(" ")}
      aria-label="Kick"
      role="img"
    >
      KICK
    </span>
  );
}
