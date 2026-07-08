"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { useAuth } from "~/app/providers/AuthProvider";
import { getSessionClient } from "~/entities/user/lib";
import { registerPushDevice } from "~/entities/push/api/push";
import { ANDROID_APP_VERSION } from "~/shared/lib/appVersion";
import {
  getNativeFcmToken,
  hasNativeNotificationPermission,
  isNativeApp,
  requestNativeNotificationPermission,
} from "~/entities/push/lib/nativeApp";

import { AppPushOptInModal } from "../ui/AppPushOptInModal";

const OPT_IN_KEY = "imba_push_optin_dismissed_v1";

export function AppPushProvider({ children }: { children: ReactNode }) {
  const { isAuth } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const registeredRef = useRef(false);

  const registerToken = useCallback(async (fcmToken: string) => {
    const session = getSessionClient();
    if (!session || !fcmToken) return;

    await registerPushDevice(session, {
      fcmToken,
      platform: "android",
      appVersion: window.ImbaApp?.getAppVersion?.() || ANDROID_APP_VERSION,
      notifyBets: true,
      notifyDeposit: true,
      notifyWithdraw: true,
      notifyPromo: false,
      notifyLiveMatch: true,
    });
    registeredRef.current = true;
  }, []);

  const maybeShowOptIn = useCallback(() => {
    if (!isNativeApp() || !isAuth) return;
    if (hasNativeNotificationPermission()) return;
    if (localStorage.getItem(OPT_IN_KEY) === "1") return;
    setShowModal(true);
  }, [isAuth]);

  useEffect(() => {
    if (!isNativeApp()) return;

    const onReady = () => {
      maybeShowOptIn();
      const token = getNativeFcmToken();
      if (token && isAuth) {
        void registerToken(token).catch(() => undefined);
      }
    };

    const onToken = (event: Event) => {
      const token = (event as CustomEvent<{ token?: string }>).detail?.token || getNativeFcmToken();
      if (token && isAuth) {
        void registerToken(token).catch(() => undefined);
      }
    };

    const onPermission = (event: Event) => {
      const granted = (event as CustomEvent<{ granted?: boolean }>).detail?.granted;
      if (granted) {
        setShowModal(false);
        const token = getNativeFcmToken();
        if (token && isAuth) {
          void registerToken(token).then(() => {
            toast.success("Уведомления включены");
          }).catch(() => undefined);
        }
      }
    };

    window.addEventListener("imba:app-ready", onReady);
    window.addEventListener("imba:fcm-token", onToken);
    window.addEventListener("imba:notification-permission", onPermission);
    onReady();

    return () => {
      window.removeEventListener("imba:app-ready", onReady);
      window.removeEventListener("imba:fcm-token", onToken);
      window.removeEventListener("imba:notification-permission", onPermission);
    };
  }, [isAuth, maybeShowOptIn, registerToken]);

  const handleEnable = () => {
    requestNativeNotificationPermission();
    window.setTimeout(() => {
      if (hasNativeNotificationPermission()) {
        setShowModal(false);
        const token = getNativeFcmToken();
        if (token && isAuth) {
          void registerToken(token).then(() => {
            toast.success("Уведомления включены");
          }).catch(() => undefined);
        }
      }
    }, 800);
  };

  const handleDismiss = () => {
    localStorage.setItem(OPT_IN_KEY, "1");
    setShowModal(false);
  };

  return (
    <>
      {children}
      {showModal ? (
        <AppPushOptInModal onDismiss={handleDismiss} onEnable={handleEnable} />
      ) : null}
    </>
  );
}
