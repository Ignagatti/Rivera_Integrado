const { contextBridge, ipcRenderer } = require('electron');

// Expone una API segura al frontend (index.html) para interactuar con el backend (main.js)
contextBridge.exposeInMainWorld('electronAPI', {
  // Función para abrir WhatsApp
  openExternal: (url) => ipcRenderer.send('open-external-link', url),
  
  // Función para guardar el respaldo local
  saveBackup: (data) => ipcRenderer.send('save-backup', data),
  
  // Función para cargar el respaldo local
  loadBackup: () => ipcRenderer.invoke('load-backup'),

  // Sincronización con base de datos PostgreSQL (Neon) compartida con Humboldt y Pedidos
  loadDbState: () => ipcRenderer.invoke('db:load-state'),
  saveDbState: (stateObj) => ipcRenderer.invoke('db:save-state', stateObj),
  sendTableToPedidos: (payload) => ipcRenderer.invoke('db:send-table-to-pedidos', payload),
  onRemoteUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('db:remote-update', handler);
    return () => ipcRenderer.removeListener('db:remote-update', handler);
  },

  // Función para guardar / descargar PDF del reporte
  savePDF: (data) => ipcRenderer.invoke('save-pdf', data),

  // Función para mostrar archivo descargado en el explorador de archivos
  showItemInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath)
});
