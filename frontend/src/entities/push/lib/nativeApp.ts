export type NativeAppBridge = {
  isNativeApp: () => boolean;
  hasNotificationPermission: () => boolean;
  requestNotificationPermission: () => void;
  getFcmToken: () => string;
  getAppVersion: () => string;
  getPlatform?: () => string;
  openUrl?: (url: string) => void;
  showNotification?: (title: string, body: string) => void;
  openSettings?: () => void;
};

declare global {
  interface Window {
    ImbaApp?: NativeAppBridge;
    __IMBA_APP__?: {
      native: boolean;
      notifications: boolean;
      fcmToken: string;
      statusBarHeight?: number;
      appVersion?: string;
      platform?: string;
    };
    __IMBA_WIN_NOTIFY__?: boolean;
  }
}

const DEFAULT_NATIVE_STATUS_BAR_PX = 28;

export function applyNativeViewportInsets(statusBarPx?: number) {
  if (typeof document === "undefined" || !isNativeApp()) return;

  document.documentElement.dataset.nativeApp = "true";
  const top =
    typeof statusBarPx === "number" && statusBarPx > 0
      ? statusBarPx
      : DEFAULT_NATIVE_STATUS_BAR_PX;
  document.documentElement.style.setProperty("--app-safe-area-top", `${top}px`);
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.ImbaApp?.isNativeApp?.()) return true;
  if (window.__IMBA_APP__?.native) return true;
  return /ImbaBetApp\//i.test(navigator.userAgent)
    || /ImbaBetWindows\//i.test(navigator.userAgent);
}

export function isWindowsNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.ImbaApp?.getPlatform?.() === "windows") return true;
  return /ImbaBetWindows\//i.test(navigator.userAgent);
}

export function getNativeFcmToken(): string {
  if (typeof window === "undefined") return "";
  return window.ImbaApp?.getFcmToken?.() || window.__IMBA_APP__?.fcmToken || "";
}

export function hasNativeNotificationPermission(): boolean {
  if (typeof window === "undefined") return false;
  if (window.ImbaApp?.hasNotificationPermission) {
    return window.ImbaApp.hasNotificationPermission();
  }
  return Boolean(window.__IMBA_APP__?.notifications);
}

export function requestNativeNotificationPermission(): void {
  window.ImbaApp?.requestNotificationPermission?.();
}

export function showNativeNotification(title: string, body: string): void {
  if (typeof window === "undefined") return;
  window.ImbaApp?.showNotification?.(title, body);
}

/** Native Android app with FCM — skip duplicate in-app toasts. */
export function shouldDeferToNativePush(): boolean {
  return isNativeApp()
    && hasNativeNotificationPermission()
    && Boolean(getNativeFcmToken());
}
