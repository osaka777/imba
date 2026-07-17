/** Phone: bottom nav + compact header */
export const LAYOUT_PHONE_MAX_PX = 767;

/** Tablet: top nav + FAB coupon, single-column main */
export const LAYOUT_TABLET_MAX_PX = 1080;

/** Desktop: 3-column layout with sticky coupon sidebar */
export const LAYOUT_DESKTOP_MIN_PX = 1081;

export const MQ_PHONE = `(max-width: ${LAYOUT_PHONE_MAX_PX}px)`;
export const MQ_TABLET = `(min-width: ${LAYOUT_PHONE_MAX_PX + 1}px) and (max-width: ${LAYOUT_TABLET_MAX_PX}px)`;
export const MQ_BELOW_DESKTOP = `(max-width: ${LAYOUT_TABLET_MAX_PX}px)`;
export const MQ_DESKTOP = `(min-width: ${LAYOUT_DESKTOP_MIN_PX}px)`;
