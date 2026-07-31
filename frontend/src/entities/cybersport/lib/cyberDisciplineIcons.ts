import type { FC } from "react";

import Cs2Icon from "~/shared/assets/icons/cyber/cs2.svg?component";
import Dota2Icon from "~/shared/assets/icons/cyber/dota2.svg?component";
import KingOfGloryIcon from "~/shared/assets/icons/cyber/king-of-glory.svg?component";
import LolIcon from "~/shared/assets/icons/cyber/lol.svg?component";
import MobileLegendsIcon from "~/shared/assets/icons/cyber/mobile-legends.svg?component";
import Overwatch2Icon from "~/shared/assets/icons/cyber/overwatch-2.svg?component";
import PubgMobileIcon from "~/shared/assets/icons/cyber/pubg-mobile.svg?component";
import RainbowSixIcon from "~/shared/assets/icons/cyber/rainbow-six.svg?component";
import ValorantIcon from "~/shared/assets/icons/cyber/valorant.svg?component";
import { ShootingIcon } from "~/shared/assets";

type SportIcon = FC<{ className?: string }>;

const BY_API_SPORT: Record<string, SportIcon> = {
  "esports.cs": Cs2Icon,
  "esports.dota2": Dota2Icon,
  "esports.lol": LolIcon,
  "esports.valorant": ValorantIcon,
  "esports.r6": RainbowSixIcon,
  "esports.mobile-legends": MobileLegendsIcon,
  "esports.kog": KingOfGloryIcon,
  "esports.overwatch2": Overwatch2Icon,
  "esports.pubg-mobile": PubgMobileIcon,
};

export function cyberDisciplineIcon(apiSport: string): SportIcon {
  return BY_API_SPORT[apiSport] ?? ShootingIcon;
}
