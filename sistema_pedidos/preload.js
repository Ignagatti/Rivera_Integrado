const { contextBridge, ipcRenderer } = require('electron');

// Exponemos la API con el nombre que espera el React de Bochas (__BOCHAS_STORAGE__)
contextBridge.exposeInMainWorld("__BOCHAS_STORAGE__", {
    loadInitial: () => ipcRenderer.invoke("storage:loadInitial"),
    set: (key, value) => ipcRenderer.invoke("storage:set", { key, value }),
    clearAll: () => ipcRenderer.invoke("storage:clearAll"),
    openNewWindow: () => ipcRenderer.invoke("window:new"),
    savePDF: (options) => ipcRenderer.invoke("report:savePDF", options),
    onUpdate: (callback) => {
        const subscription = (_event, payload) => callback(payload);
        ipcRenderer.on("storage:update", subscription);
        return () => ipcRenderer.removeListener("storage:update", subscription);
    }
});