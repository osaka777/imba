const {
  app,
  BrowserWindow,
  shell,
  Menu,
  session,
  Tray,
  nativeImage,
  Notification,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const HOME_URL = "https://imba.bet/";
const ALLOWED_HOSTS = new Set(["imba.bet", "www.imba.bet"]);
const APP_VERSION = app.getVersion();
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  minimizeToTray: true,
  launchOnStartup: false,
  firstRunDone: false,
};

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
let updateCheckInFlight = false;
let updateDownloaded = false;

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(next) {
  const merged = { ...loadSettings(), ...next };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf8");
  applyStartupSetting(merged.launchOnStartup);
  return merged;
}

function applyStartupSetting(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      path: process.execPath,
      args: [],
    });
  } catch {
    // ignore on non-packaged
  }
}

function isAllowedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOSTS.has(host) || host.endsWith(".imba.bet");
  } catch {
    return false;
  }
}

function iconPath() {
  return path.join(__dirname, "icon.png");
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function buildAppMenuTemplate() {
  return [
    {
      label: "Imba",
      submenu: [
        { label: "Настройки…", click: () => openSettingsWindow() },
        {
          label: "Проверить обновления…",
          click: () => checkForAppUpdates({ manual: true }),
        },
        { type: "separator" },
        { role: "reload", label: "Обновить" },
        { type: "separator" },
        {
          label: "Выход",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
  ];
}

function createTray() {
  if (tray) return;
  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.resize({ width: 16, height: 16 }));
  tray.setToolTip("Imba");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Открыть Imba", click: () => showMainWindow() },
      {
        label: "Настройки уведомлений",
        click: () => openSettingsWindow(),
      },
      {
        label: "Проверить обновления…",
        click: () => checkForAppUpdates({ manual: true }),
      },
      { type: "separator" },
      {
        label: "Выход",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => showMainWindow());
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("update-available", (info) => {
    if (Notification.isSupported() && loadSettings().notificationsEnabled) {
      showOsNotification(
        "Доступно обновление",
        `Скачивается Imba ${info.version}…`,
      );
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateDownloaded = true;
    dialog
      .showMessageBox(mainWindow || undefined, {
        type: "info",
        title: "Обновление Imba",
        message: `Версия ${info.version} готова к установке`,
        detail: "Перезапустить приложение сейчас? Можно отложить — установка пройдёт при следующем выходе.",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      })
      .then(({ response }) => {
        if (response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall(false, true);
        }
      })
      .catch(() => {});
  });

  autoUpdater.on("error", (err) => {
    console.error("[autoUpdater]", err?.message || err);
  });
}

/**
 * @param {{ manual?: boolean }} [opts]
 */
async function checkForAppUpdates(opts = {}) {
  const manual = Boolean(opts.manual);
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox(mainWindow || undefined, {
        type: "info",
        title: "Imba",
        message: "Проверка обновлений доступна только в установленной версии.",
      });
    }
    return;
  }

  if (updateDownloaded) {
    if (manual) {
      const { response } = await dialog.showMessageBox(mainWindow || undefined, {
        type: "info",
        title: "Обновление Imba",
        message: "Обновление уже скачано",
        detail: "Перезапустить сейчас, чтобы установить?",
        buttons: ["Перезапустить", "Позже"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    }
    return;
  }

  if (updateCheckInFlight) return;
  updateCheckInFlight = true;

  try {
    const result = await autoUpdater.checkForUpdates();
    if (manual && result?.updateInfo) {
      const remote = String(result.updateInfo.version || "");
      if (remote && remote === APP_VERSION) {
        dialog.showMessageBox(mainWindow || undefined, {
          type: "info",
          title: "Imba",
          message: `У вас актуальная версия ${APP_VERSION}`,
        });
      }
    }
  } catch (err) {
    console.error("[autoUpdater] check failed", err?.message || err);
    if (manual) {
      dialog.showMessageBox(mainWindow || undefined, {
        type: "warning",
        title: "Imba",
        message: "Не удалось проверить обновления",
        detail: "Проверьте интернет и попробуйте позже.",
      });
    }
  } finally {
    updateCheckInFlight = false;
  }
}

function createWindow() {
  const settings = loadSettings();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#090f1e",
    autoHideMenuBar: true,
    title: "Imba",
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate()));

  const ua = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${ua} ImbaBetWindows/${APP_VERSION}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      mainWindow?.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (!settings.firstRunDone) {
      openSettingsWindow(true);
    }
  });

  mainWindow.on("close", (event) => {
    const current = loadSettings();
    if (!isQuitting && current.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      if (!tray) createTray();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(HOME_URL);
  createTray();
}

/** @type {BrowserWindow | null} */
let settingsWindow = null;

function openSettingsWindow(isFirstRun = false) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 440,
    height: isFirstRun ? 460 : 420,
    resizable: false,
    maximizable: false,
    minimizable: false,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    autoHideMenuBar: true,
    title: "Настройки Imba",
    backgroundColor: "#121a2c",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, "settings.html"), {
    query: { first: isFirstRun ? "1" : "0" },
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function showOsNotification(title, body) {
  const settings = loadSettings();
  if (!settings.notificationsEnabled) return;
  if (!Notification.isSupported()) return;

  const note = new Notification({
    title: title || "Imba",
    body: body || "",
    icon: iconPath(),
  });
  note.on("click", () => showMainWindow());
  note.show();
}

ipcMain.handle("settings:get", () => loadSettings());

ipcMain.handle("settings:save", (_event, payload) => {
  const prev = loadSettings();
  const saved = saveSettings({
    ...payload,
    firstRunDone: true,
  });
  if (saved.notificationsEnabled && !prev.notificationsEnabled && Notification.isSupported()) {
    showOsNotification(
      "Уведомления включены",
      "Imba будет показывать оповещения о ставках и кассе на этом ПК.",
    );
  }
  return saved;
});

ipcMain.handle("settings:close", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

ipcMain.handle("settings:open", () => {
  openSettingsWindow(false);
});

ipcMain.handle("app:notify", (_event, payload) => {
  showOsNotification(payload?.title, payload?.body);
  return true;
});

ipcMain.handle("app:getVersion", () => APP_VERSION);

ipcMain.handle("app:notificationPermission", async () => {
  // Electron Notification doesn't use browser permission the same way;
  // we track via settings + OS capability.
  const settings = loadSettings();
  return {
    supported: Notification.isSupported(),
    granted: Boolean(settings.notificationsEnabled),
  };
});

ipcMain.handle("app:requestNotificationPermission", async () => {
  const settings = saveSettings({ notificationsEnabled: true, firstRunDone: true });
  if (Notification.isSupported()) {
    showOsNotification(
      "Уведомления включены",
      "Imba будет показывать оповещения о ставках и кассе на этом ПК.",
    );
  } else {
    dialog.showMessageBox({
      type: "warning",
      title: "Imba",
      message: "Системные уведомления недоступны в этой среде Windows.",
    });
  }
  return { granted: settings.notificationsEnabled };
});

app.whenReady().then(() => {
  applyStartupSetting(loadSettings().launchOnStartup);
  setupAutoUpdater();

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allow =
      permission === "notifications"
      || permission === "media"
      || permission === "clipboard-sanitized-write";
    callback(allow);
  });

  createWindow();

  // Check updates shortly after launch (site feed: https://imba.bet/latest.yml).
  setTimeout(() => {
    checkForAppUpdates({ manual: false }).catch(() => {});
  }, 4000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) app.quit();
});
