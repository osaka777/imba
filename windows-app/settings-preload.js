const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ImbaSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  save: (payload) => ipcRenderer.invoke("settings:save", payload),
  close: () => ipcRenderer.invoke("settings:close"),
});
