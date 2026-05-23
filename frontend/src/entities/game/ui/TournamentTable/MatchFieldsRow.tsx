import { components } from "~/shared/api";

import { MatchFieldsCell } from "./MatchFieldsCell";
import styles from "./MatchRow.module.css";

type MatchFieldsRowProps = {
  eventId: string;
  eventName: string;
  fields: {
    coef: string;
    groupedMarket: components["schemas"]["MarketDto"];
    isOpen: boolean;
    market: string;
  }[];
  sport: string;
  isLive: boolean;
};

export const MatchFieldsRow: React.FC<MatchFieldsRowProps> = ({
  eventId,
  eventName,
  fields,
  sport,
  isLive,
}) => {
  return (
    <>
      {fields.map((field, index) => {
        return (
          <MatchFieldsCell
            eventId={eventId}
            eventName={eventName}
            groupedMarket={field.groupedMarket}
            isOpen={field.isOpen}
            key={field.market + index}
            market={field.market}
            value={field.coef}
            isLive={isLive}
          />
        );
      })}
    </>
  );
};
