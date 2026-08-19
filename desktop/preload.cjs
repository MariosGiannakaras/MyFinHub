const { contextBridge, ipcRenderer } = require('electron');

const updateChannel = 'myfinhub:update-state';
const setupProgressChannel = 'myfinhub:setup-progress';

contextBridge.exposeInMainWorld('myFinHubDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('myfinhub:get-info'),
  getUpdateState: () => ipcRenderer.invoke('myfinhub:get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('myfinhub:check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('myfinhub:download-update'),
  installUpdate: () => ipcRenderer.invoke('myfinhub:install-update'),
  onUpdateState: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, state) => listener(state);
    ipcRenderer.on(updateChannel, handler);
    return () => ipcRenderer.removeListener(updateChannel, handler);
  },
  getSetupState: () => ipcRenderer.invoke('myfinhub:get-setup-state'),
  saveSetup: (value) => ipcRenderer.invoke('myfinhub:save-setup', value),
  onSetupProgress: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, state) => listener(state);
    ipcRenderer.on(setupProgressChannel, handler);
    return () => ipcRenderer.removeListener(setupProgressChannel, handler);
  },
}));
