// -----------------------------------------------------
// SingleBetRow: универсальный вариант для рендера
// (одно "item" из массива), поддерживающий toggleRate.

import { components } from "~/shared/api";
import { usePrevious } from "~/shared/model";
import styles from "./Match.module.css";
import { Button } from "~/shared/ui";
import { cn } from "~/shared/lib";
// Removed createTitleForBet import - using oc_name directly from API
import { convertToFixed } from "../../lib";
import { AccessIcon } from "~/shared/assets";

// -----------------------------------------------------
type MarketDto = components["schemas"]["MarketDto"];
export function SingleBetRow({
    item,
    toggleRate,
    isRateAdded,
    is1X2,
  }: {
    item: MarketDto;
    toggleRate: (item: MarketDto) => () => void;
    isRateAdded: boolean;
    is1X2?: boolean;
  }) {
    
    const value = `${item.cf}`;
    const { prevState } = usePrevious(value, 800); // Дебаунсинг 800мс для предотвращения мерцания
  
    // Проверяем доступность ставки: если oc_block === true, то ставка заблокирована
    const isAvailable = !item.oc_block && ((item as any).isOpen !== false) && (item.available !== false);
    
    // Логика «мигания» коэффициента (рост / падение)
    // Не показываем анимацию для заблокированных рынков
    let coefClass = "";
    if (typeof prevState !== "undefined" && isAvailable) {
      if (+value > +prevState) coefClass = styles.oddCoefficient_up;
      else if (+value < +prevState) coefClass = styles.oddCoefficient_down;
    }
    
    return (
      <div className={cn(styles.oddsItem, !isAvailable && styles.oddsItem_lock, is1X2 && styles.oddsItem_1x2)}>
        <Button
          className={cn(styles.odd, styles.odd_left, isRateAdded && styles.odd_added)}
          disabled={!isAvailable}
          onClick={toggleRate(item)}
        >
          <p className="text-sm font-medium text-black">
            {(item as any).oc_name || item.market}
          </p>
          <p className={cn(styles.oddCoef, coefClass)}>
            {convertToFixed(value)}
            {!isAvailable && <AccessIcon className={styles.lock} />}
          </p>
        </Button>
      </div>
    );
  }