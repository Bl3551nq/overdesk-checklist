const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

  // ── License ──────────────────────────────────────────
  checkLicense:    ()    => ipcRenderer.invoke('check-license'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),

  // ── Window flow ──────────────────────────────────────
  launchApp: () => ipcRenderer.invoke('launch-app'),
  closeApp:  () => ipcRenderer.invoke('close-app'),

  // ── Window drag (IPC-based, works with transparent frameless) ──
  dragStart: (x, y) => ipcRenderer.send('window-drag-start', { x, y }),
  dragMove:  (x, y) => ipcRenderer.send('window-drag-move',  { x, y }),
  dragEnd:   ()     => ipcRenderer.send('window-drag-end'),

  // ── Scale ────────────────────────────────────────────
  scaleStart: ()    => ipcRenderer.invoke('scale-start'),
  scaleEnd:   (s)   => ipcRenderer.invoke('scale-end', s),
  scaleMove:  (s)   => ipcRenderer.send('scale-move', s),

  // ── Pin ──────────────────────────────────────────────
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),

  // ── Auto-updater ─────────────────────────────────────
  installUpdate:      ()   => ipcRenderer.invoke('install-update'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_, v) => cb(v)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, v) => cb(v)),
})
