import { cn } from "~/shared/lib";

import cardStyles from "~/entities/wc-odds/ui/WcTeamCardBadges.module.css";

const YELLOW_CARD_SRC = "/yellow.png";
const RED_CARD_SRC = "/Red_card.svg";

type WcTeamCardBadgesProps = {
  yellow?: number;
  red?: number;
  /** List rows: icon only; count on desktop hover. Scoreboard: always show count. */
  countMode?: "always" | "hover";
};

export function WcTeamCardBadges({
  yellow = 0,
  red = 0,
  countMode = "always",
}: WcTeamCardBadgesProps) {
  if (yellow <= 0 && red <= 0) return null;

  return (
    <span
      className={cn(
        cardStyles.badges,
        countMode === "hover" && cardStyles.badges_countOnHover,
      )}
    >
      {yellow > 0 && (
        <span className={cn(cardStyles.badge, cardStyles.badgeYellow)} title="Жёлтые карточки">
          <img alt="" className={cardStyles.icon} src={YELLOW_CARD_SRC} />
          <span className={cardStyles.count} data-card-count={countMode === "hover" ? "" : undefined}>
            {yellow}
          </span>
        </span>
      )}
      {red > 0 && (
        <span className={cn(cardStyles.badge, cardStyles.badgeRed)} title="Красные карточки">
          <img alt="" className={cardStyles.icon} src={RED_CARD_SRC} />
          <span className={cardStyles.count} data-card-count={countMode === "hover" ? "" : undefined}>
            {red}
          </span>
        </span>
      )}
    </span>
  );
}
