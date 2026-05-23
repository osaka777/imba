// prettier-ignore

export const gameTypes = {
    ASIAN_TOTALS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>ASIAN_TOTALS)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    ASIAN_TOTALS_CORNERS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>ASIAN_TOTALS_CORNERS?)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    CLEAN_SHEET:
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>CLEAN_SHEET)__(?<plr>P[12])__(?<dst>YES|NO)$!",
    CORRECT_SCORE:
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>CORRECT_SCORE)(?:_(?<ot_rt>OT|RT|ET))?\\((?<pivot>[0-9]+:[0-9]+|ANY_OTHER|ANY_P[12])\\)$!",
    FIRST_TO_SCORE: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>FIRST_TO_SCORE)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]))$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>FIRST_TO_SCORE)_?(?<_3w>3W)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]|NO))$!",
    ],
    GAME_WIN: "!^(?<basis>GAME)(?:_(?<ot_rt>CT))?__(?<pivot>\\d\\d_\\d\\d)__(?<plr>P[12])$!",
    HANDICAP: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>HANDICAP)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])\\((?<pivot>-?[\\d]+(?:\\.(?:25|5|75))?|PK)\\)$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>HANDICAP)_?(?<_3w>3W)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12X])\\((?<pivot>-?[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    HANDICAP_CORNERS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>HANDICAP_CORNERS?)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])\\((?<pivot>-?[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>HANDICAP)_?(?<_3w>3W)_CORNERS?(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12X])\\((?<pivot>-?[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    PLAYER_TO_SCORE: "!^(?<basis>PLAYER_TO_SCORE)__(?<pivot>0\\d|\\d{2,2}|ANYTIME)\\((?<plr>\\w+)\\)$!",
    SETS_HANDICAP: [
        "!^(?<basis>SETS_HANDICAP)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])\\((?<pivot>-?[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    SETS_TOTALS: [
        "!^(?<basis>SETS_TOTALS)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    TEAM_TOTALS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TEAM_TOTALS)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    TEAM_TOTALS_CORNERS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TEAM_TOTALS_CORNERS?)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    TEAM_TOTALS_ODD: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TEAM_TOTALS_ODD)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<plr>P[12])__(?<dst>ODD|EVEN)$!",
    ],
    TEAMS_TO_SCORE: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(((BOTH_TEAMS|ONLY_ONE_TEAM|NO_ONE)_TO_SCORE|(ONLY_)?(?<basis>TEAM_TO_SCORE)__(?<plr>P[12]))__(?<dst>YES|NO))$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?LAST_(?<basis>TEAM_TO_SCORE)__(?<plr>(?:P[12]|NO))$!",
    ],
    TO_QUALIFY: "!^(?<basis>TO_QUALIFY)\\((?<plr>P[12])\\)$!",
    TOTALS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TOTALS)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    TOTALS_CORNERS: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TOTALS_CORNERS?)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>OVER|UNDER)\\((?<pivot>[\\d]+(?:\\.(?:25|5|75))?)\\)$!",
    ],
    TOTALS_CORNERS_ODD: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TOTALS_CORNERS_ODD)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>ODD|EVEN)$!",
    ],
    TOTALS_ODD: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>TOTALS_ODD)(?:_(?<ot_rt>OT|RT|ET|CT))?__(?<dst>ODD|EVEN)$!",
    ],
    WHO_SCORE: [
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WHO_SCORE)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]))$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WHO_SCORE)_?(?<_3w>3W)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]|NO))$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WHO_SCORE)_?(?<ot_rt>OT|RT|ET|CT)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]|NO))$!",
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WHO_SCORE)_(?<_3w>3W)_(?<ot_rt>OT|RT|ET|CT)__(?<pivot>\\d\\d\\d?(?:_\\d\\d)?)__(?<plr>(?:P[12]|NO))$!",
    ],
    WILL_BE_OT: "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WILL_BE_OT)__(?<dst>YES|NO)$!",
    WIN: "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WIN)(?:_(?<ot_rt>OT|RT|ET))?__(?<plr>P[12X]|1X|2X|X2|12)$!",
    WIN_CORNERS:
        "!^(?:(?<period_name>SET|HALF)_(?<period_no>\\d\\d)__)?(?<basis>WIN_CORNERS)?__(?<plr>P[12X]|1X|2X|X2|12)$!",
    WIN_HALF_MATCH: "!^(?<basis>WIN_HALF_MATCH)__(?<pivot>(?:P[12X]|12|1X|X2)_(?:P[12X]|12|1X|X2))$!",
    WIN_PLACE: "!^(?<plr>P\\d{1,2})__(?<basis>PLACE)\\(\\d{1,2}[-+]?\\)$!",
};
