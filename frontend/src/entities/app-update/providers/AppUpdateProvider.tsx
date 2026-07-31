"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

import {
  fetchAndroidAppManifest,
  isAndroidUpdateAvailable,
  resolveApkAbsoluteUrl,
  type AndroidAppManifest,
} from "~/entities/app-update/lib/androidManifest";
import { AppUpdateModal } from "~/entities/app-update/ui/AppUpdateModal";
import {
  isNativeApp,
  isWindowsNativeApp,
} from "~/entities/push/lib/nativeApp";

const SNOOZE_KEY = "imba_apk_update_snooze_v1";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function readInstalledVersion(): string {
  if (typeof window === "undefined") return "";
  const fromBridge = window.ImbaApp?.getAppVersion?.();
  if (fromBridge) return fromBridge;
  const fromInjected = window.__IMBA_APP__?.appVersion;
  if (fromInjected) return fromInjected;
  const ua = navigator.userAgent.match(/ImbaBetApp\/([\d.]+)/i);
  return ua?.[1] ?? "";
}

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* ignore */
  }
}

function openApk(url: string) {
  const absolute = resolveApkAbsoluteUrl(url);
  if (window.ImbaApp && typeof (window.ImbaApp as { openUrl?: (u: string) => void }).openUrl === "function") {
    (window.ImbaApp as { openUrl: (u: string) => void }).openUrl(absolute);
    return;
  }
  window.location.assign(absolute);
}

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<AndroidAppManifest | null>(null);
  const [installedVersion, setInstalledVersion] = useState("");
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    if (!isNativeApp() || isWindowsNativeApp()) return;
    if (isSnoozed()) return;

    const installed = readInstalledVersion();
    if (!installed) return;

    const remote = await fetchAndroidAppManifest();
    if (!remote || !isAndroidUpdateAvailable(installed, remote)) return;

    setInstalledVersion(installed);
    setManifest(remote);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!isNativeApp() || isWindowsNativeApp()) return;

    const run = () => {
      void check();
    };

    run();
    window.addEventListener("imba:app-ready", run);
    return () => window.removeEventListener("imba:app-ready", run);
  }, [check]);

  const onLater = () => {
    snooze();
    setOpen(false);
  };

  const onUpdate = () => {
    if (!manifest) return;
    openApk(manifest.apkUrl);
    // Keep modal briefly — user may return after installer
    snooze();
    setOpen(false);
  };

  return (
    <>
      {children}
      {open && manifest ? (
        <AppUpdateModal
          installedVersion={installedVersion}
          manifest={manifest}
          onLater={onLater}
          onUpdate={onUpdate}
        />
      ) : null}
    </>
  );
}
