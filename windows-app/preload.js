const { contextBridge, ipcRenderer } = require("electron");

const APP_VERSION = "1.1.0";

contextBridge.exposeInMainWorld("ImbaApp", {
  isNativeApp: () => true,
  getPlatform: () => "windows",
  getAppVersion: () => APP_VERSION,
  getFcmToken: () => "",
  hasNotificationPermission: () => {
    // Synced via settings on demand; default optimistic from last IPC cache
    return Boolean(window.__IMBA_WIN_NOTIFY__);
  },
  requestNotificationPermission: () => {
    ipcRenderer
      .invoke("app:requestNotificationPermission")
      .then((result) => {
        window.__IMBA_WIN_NOTIFY__ = Boolean(result?.granted);
        window.dispatchEvent(
          new CustomEvent("imba:notification-permission", {
            detail: { granted: Boolean(result?.granted) },
          }),
        );
      })
      .catch(() => undefined);
  },
  showNotification: (title, body) => {
    void ipcRenderer.invoke("app:notify", { title, body });
  },
  openSettings: () => {
    void ipcRenderer.invoke("settings:open");
  },
});

ipcRenderer.invoke("app:notificationPermission").then((state) => {
  window.__IMBA_WIN_NOTIFY__ = Boolean(state?.granted);
  window.dispatchEvent(new Event("imba:app-ready"));
}).catch(() => {
  window.dispatchEvent(new Event("imba:app-ready"));
});
