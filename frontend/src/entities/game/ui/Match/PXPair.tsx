import { components } from "~/shared/api";
import { usePrevious } from "~/shared/model";
import { Button } from "~/shared/ui";
import { convertToFixed } from "../../lib";
import styles from "./Match.module.css";
import { cn } from "~/shared/lib";
import { AccessIcon } from "~/shared/assets";
import { createTitleForBet } from "~/entities/bet/lib";
import { useLocale } from "~/shared/model/useLocale";

type MarketDto = components["schemas"]["MarketDto"];

export function PXPair({
    isRateAddedP1,
    isRateAddedP2,
    isRateAddedPX,
    p1,
    p2,
    px,
    toggleRate,
}: {
    isRateAddedP1: boolean;
    isRateAddedP2: boolean;
    isRateAddedPX: boolean;
    p1: MarketDto;
    p2: MarketDto;
    px: MarketDto;
    toggleRate: (item: MarketDto) => () => void;
}) {
    const { t } = useLocale();
    // Коэффициенты
    const p1Value = `${p1.cf}`;
    const p2Value = `${p2.cf}`;
    const pxValue = `${px.cf}`;

    // Предыдущие значения для мигания с дебаунсингом
    const { prevState: prevP1 } = usePrevious(p1Value, 800);
    const { prevState: prevP2 } = usePrevious(p2Value, 800);
    const { prevState: prevPX } = usePrevious(pxValue, 800);

    let p1CoefClass = "";
    if (typeof prevP1 !== "undefined") {
        if (+p1Value > +prevP1) p1CoefClass = styles.oddCoefficient_up;
        else if (+p1Value < +prevP1) p1CoefClass = styles.oddCoefficient_down;
    }

    let p2CoefClass = "";
    if (typeof prevP2 !== "undefined") {
        if (+p2Value > +prevP2) p2CoefClass = styles.oddCoefficient_up;
        else if (+p2Value < +prevP2) p2CoefClass = styles.oddCoefficient_down;
    }

    let pxCoefClass = "";
    if (typeof prevPX !== "undefined") {
        if (+pxValue > +prevPX) pxCoefClass = styles.oddCoefficient_up;
        else if (+pxValue < +prevPX) pxCoefClass = styles.oddCoefficient_down;
    }

    return (
        <>
            {/* P1 */}
            <div className={cn(styles.oddsItem, (!p1.available || p1.oc_block) && styles.oddsItem_lock, styles.oddsItemPX)}>
                <Button
                    className={cn(styles.odd, isRateAddedP1 && styles.odd_added)}
                    disabled={!p1.available || !!p1.oc_block}
                    onClick={toggleRate(p1)}
                >
                    <p className="text-sm font-medium text-black">
                        {createTitleForBet(p1, undefined, t)}
                    </p>
                    <p className={cn(styles.oddCoef, p1CoefClass)}>
                        {convertToFixed(p1Value)}
                        {!p1.available && <AccessIcon className={styles.lock} />}
                    </p>
                </Button>
            </div>

            {/* PX (ничья) */}
            <div className={cn(styles.oddsItem, (!px.available || px.oc_block) && styles.oddsItem_lock, styles.oddsItemPX)}>
                <Button
                    className={cn(styles.odd, isRateAddedPX && styles.odd_added)}
                    disabled={!px.available || !!px.oc_block}
                    onClick={toggleRate(px)}
                >
                    <p className="text-sm font-medium text-black">
                        {createTitleForBet(px, undefined, t)}
                    </p>
                    <p className={cn(styles.oddCoef, pxCoefClass)}>
                        {convertToFixed(pxValue)}
                        {!px.available && <AccessIcon className={styles.lock} />}
                    </p>
                </Button>
            </div>

            {/* P2 */}
            <div className={cn(styles.oddsItem, (!p2.available || p2.oc_block) && styles.oddsItem_lock, styles.oddsItemPX)}>
                <Button
                    className={cn(styles.odd, isRateAddedP2 && styles.odd_added)}
                    disabled={!p2.available || !!p2.oc_block}
                    onClick={toggleRate(p2)}
                >
                    <p className="text-sm font-medium text-black">
                        {createTitleForBet(p2, undefined, t)}
                    </p>
                    <p className={cn(styles.oddCoef, p2CoefClass)}>
                        {convertToFixed(p2Value)}
                        {!p2.available && <AccessIcon className={styles.lock} />}
                    </p>
                </Button>
            </div>
        </>
    );
}
