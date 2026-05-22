const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // License
  checkLicense:    ()      => ipcRenderer.invoke('check-license'),
  activateLicense: (key)   => ipcRenderer.invoke('activate-license', key),
  validateLicense: (key)   => ipcRenderer.invoke('validate-license', key),

  // Window flow
  launchApp:       ()      => ipcRenderer.invoke('launch-app'),
  closeApp:        ()      => ipcRenderer.invoke('close-app'),

  // Widget controls
  setAlwaysOnTop:  (flag)  => ipcRenderer.invoke('set-always-on-top', flag),
  scaleEnd:        (scale) => ipcRenderer.invoke('scale-end', scale),

  // Auto-updater
  installUpdate:      ()   => ipcRenderer.invoke('install-update'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
})
