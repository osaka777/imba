/** Light haptic on successful bet (Android TWA / mobile browsers). */
export function hapticBetAccepted(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate([12, 40, 12]);
  } catch {
    // ignore unsupported vibrate
  }
}
