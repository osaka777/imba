import { useEffect, useState } from "react";

import { components } from "~/shared/api";
import { ArrowIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";

import { OddsItem } from "./OddsItem";
import styles from "./Match.module.css";

type MarketDto = components["schemas"]["MarketDto"];

export type { MarketDto };

type OddsTableProps = {
  eventId: string;
  eventName: string;
  markets: components["schemas"]["MarketDto"][];
  name: string;
  isParentExpanded?: boolean;
  isLive?: boolean;
  subGameId?: number;
  subGameName?: string;
  parentEventId?: string;
};



export const OddsTable = ({
  eventId,
  eventName,
  markets,
  name,
  isParentExpanded,
  isLive,
  subGameId,
  subGameName,
  parentEventId,
}: OddsTableProps) => {
  const [isFolded, setIsFolded] = useState(false);

  const toggleFold = () => setIsFolded((prev) => !prev);
  
  // Рендерим весь массив markets как одну группу, чтобы корректно работать с парами (WIN и т.д.)

  useEffect(() => {
    setIsFolded(!isParentExpanded);
  }, [isParentExpanded]);

  if (!isParentExpanded) {
    return (
      <div>
        <Button className={styles.oddFold} onClick={toggleFold}>
          <p className="text-sm font-medium">{name}</p>
          <ArrowIcon className="size-3 fill-white" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button className={styles.oddFold} onClick={toggleFold}>
        <p className="text-sm font-medium">{name}</p>
        <ArrowIcon className="size-3 fill-white" />
      </Button>
      <div className={cn(styles.oddsList, isFolded && styles.oddsList_hidden)}>
        <OddsItem
          eventId={eventId}
          eventName={eventName}
          key={name}
          marketData={markets}
          isLive={!!isLive}
          subGameId={subGameId}
          subGameName={subGameName}
          parentEventId={parentEventId}
          groupName={name}
        />
      </div>
    </div>
  );
};
