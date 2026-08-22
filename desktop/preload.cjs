const { contextBridge, ipcRenderer } = require('electron');

const updateChannel = 'myfinhub:update-state';
const startupProgressChannel = 'myfinhub:startup-progress';

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
  getRecoveryState: () => ipcRenderer.invoke('myfinhub:get-recovery-state'),
  retryStartup: () => ipcRenderer.invoke('myfinhub:retry-startup'),
  copyStartupDiagnostics: () => ipcRenderer.invoke('myfinhub:copy-startup-diagnostics'),
  onStartupProgress: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, state) => listener(state);
    ipcRenderer.on(startupProgressChannel, handler);
    return () => ipcRenderer.removeListener(startupProgressChannel, handler);
  },
}));