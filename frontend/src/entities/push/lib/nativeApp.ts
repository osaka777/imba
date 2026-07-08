export type NativeAppBridge = {
  isNativeApp: () => boolean;
  hasNotificationPermission: () => boolean;
  requestNotificationPermission: () => void;
  getFcmToken: () => string;
  getAppVersion: () => string;
};

declare global {
  interface Window {
    ImbaApp?: NativeAppBridge;
    __IMBA_APP__?: {
      native: boolean;
      notifications: boolean;
      fcmToken: string;
    };
  }
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.ImbaApp?.isNativeApp?.()) return true;
  if (window.__IMBA_APP__?.native) return true;
  return /ImbaBetApp\//i.test(navigator.userAgent);
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
