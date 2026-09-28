const { contextBridge, ipcRenderer } = require('electron');

const updateChannel = 'myfinhub:update-state';
const startupProgressChannel = 'myfinhub:setup-progress';

async function rawRecoveryState() {
  return ipcRenderer.invoke('myfinhub:get-setup-state');
}

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
  getAppLockState: () => ipcRenderer.invoke('myfinhub:get-app-lock-state'),
  verifyAppPin: (pin) => ipcRenderer.invoke('myfinhub:verify-app-pin', pin),
  setAppPin: (value) => ipcRenderer.invoke('myfinhub:set-app-pin', value),
  setAppLockTimeout: (minutes) => ipcRenderer.invoke('myfinhub:set-app-lock-timeout', minutes),
  disableAppPin: () => ipcRenderer.invoke('myfinhub:disable-app-pin'),
  getRecoveryState: async () => {
    const state = await rawRecoveryState();
    return {
      progress: state?.progress,
      step: state?.step,
      message: state?.message,
      error: state?.error || null,
    };
  },
  retryStartup: async () => {
    const state = await rawRecoveryState();
    return ipcRenderer.invoke('myfinhub:save-setup', {
      supabaseUrl: state?.supabaseUrl || '',
      supabasePublishableKey: state?.supabasePublishableKey || '',
      cardVaultKey: '',
      cardVaultKeyVersion: Number(state?.cardVaultKeyVersion || 1),
    });
  },
  copyStartupDiagnostics: () => ipcRenderer.invoke('myfinhub:copy-setup-diagnostics'),
  onStartupProgress: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, state) => listener(state);
    ipcRenderer.on(startupProgressChannel, handler);
    return () => ipcRenderer.removeListener(startupProgressChannel, handler);
  },
}));
