import styles from "~/entities/game/ui/TournamentTable/MatchRow.module.css";

type WcMatchTotalPivotProps = {
  line: number | null;
};

export function WcMatchTotalPivot({ line }: WcMatchTotalPivotProps) {
  return (
    <div className={`${styles.oddCell} ${styles.oddCell_special}`} data-market="WC__totals__PIVOT">
      <p className={styles.oddCoefficient}>{line != null ? line : "--"}</p>
    </div>
  );
}
