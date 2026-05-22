const {
  app, BrowserWindow, Tray, Menu,
  ipcMain, nativeImage, screen
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
const IS_DEV = !app.isPackaged

const USERDATA     = app.getPath('userData')
const LICENSE_FILE = path.join(USERDATA, 'license.json')

function res(file) {
  return IS_DEV
    ? path.join(__dirname, 'build', file)
    : path.join(process.resourcesPath, file)
}

// ─── License ────────────────────────────────────────────
function readLicense() {
  try   { return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')) }
  catch { return null }
}
function saveLicense(key) {
  fs.mkdirSync(USERDATA, { recursive: true })
  fs.writeFileSync(LICENSE_FILE, JSON.stringify({ key, ts: Date.now() }))
}

let tray    = null
let mainWin = null
let actWin  = null

const BASE_W = 380
const BASE_H = 640

// ─── Activation window ──────────────────────────────────
function createActivateWin() {
  actWin = new BrowserWindow({
    width:           440,
    height:          620,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    resizable:       false,
    alwaysOnTop:     true,
    center:          true,
    icon:            res('icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })
  actWin.loadFile(path.join(__dirname, 'src', 'activate.html'))
  if (IS_DEV) actWin.webContents.openDevTools({ mode: 'detach' })
  actWin.on('closed', () => { actWin = null })
}

// ─── Main app window ────────────────────────────────────
function createMainWin() {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  mainWin = new BrowserWindow({
    width:           BASE_W,
    height:          BASE_H,
    x:               width - BASE_W - 40,
    y:               60,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    resizable:       true,
    alwaysOnTop:     true,
    skipTaskbar:     false,
    hasShadow:       false,
    icon:            res('icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })

  mainWin.loadFile(path.join(__dirname, 'src', 'checklist.html'))

  mainWin.webContents.on('did-finish-load', () => {
    // Only inject transparency — NO -webkit-app-region at all.
    // Dragging is handled by startWindowDragging() via IPC instead,
    // which means all JS mouse events work normally everywhere.
    mainWin.webContents.insertCSS(`
      html, body { background: transparent !important; margin: 0; padding: 0; }
    `)
  })

  if (IS_DEV) mainWin.webContents.openDevTools({ mode: 'detach' })
  mainWin.on('closed', () => { mainWin = null })
}

// ─── Tray ────────────────────────────────────────────────
function setupTray() {
  const raw = nativeImage.createFromPath(res('icon.png'))
  const img = raw.resize({ width: 16, height: 16 })
  if (IS_MAC) img.setTemplateImage(true)

  tray = new Tray(img)
  tray.setToolTip('Overdesk Checklist')

  const ctxMenu = Menu.buildFromTemplate([
    { label: 'Show',  click: () => { if (mainWin) mainWin.show(); else createMainWin() } },
    { label: 'Hide',  click: () => { if (mainWin) mainWin.hide() } },
    { type: 'separator' },
    { label: 'Quit Overdesk', click: () => app.quit() },
  ])
  tray.setContextMenu(ctxMenu)
  tray.on('click',        () => { if (mainWin) mainWin.isVisible() ? mainWin.hide() : mainWin.show() })
  tray.on('double-click', () => { if (mainWin) mainWin.show() })
}

// ─── Auto-updater ────────────────────────────────────────
function setupUpdater() {
  if (IS_DEV) return
  autoUpdater.autoDownload             = true
  autoUpdater.autoInstallOnAppQuit     = false
  autoUpdater.on('update-available',  info => { if (mainWin) mainWin.webContents.send('update-available',  info.version) })
  autoUpdater.on('update-downloaded', info => { if (mainWin) mainWin.webContents.send('update-downloaded', info.version) })
  autoUpdater.on('error', err => console.error('Updater:', err.message))
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}

// ─── App lifecycle ───────────────────────────────────────
app.whenReady().then(() => {
  if (IS_MAC) app.dock.hide()
  setupTray()
  setupUpdater()
  readLicense()?.key ? createMainWin() : createActivateWin()
})

app.on('window-all-closed', e => e.preventDefault())

// ─── IPC ─────────────────────────────────────────────────
ipcMain.handle('check-license',    ()       => ({ activated: !!readLicense()?.key }))
ipcMain.handle('activate-license', (_, key) => { saveLicense(key); return { ok: true } })
ipcMain.handle('validate-license', (_, key) => { saveLicense(key); return { ok: true } })

ipcMain.handle('launch-app', () => {
  if (actWin) { actWin.close(); actWin = null }
  createMainWin()
})

ipcMain.handle('close-app', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.hide()
})

ipcMain.handle('set-always-on-top', (_, flag) => {
  if (mainWin) mainWin.setAlwaysOnTop(flag, 'floating')
})

// ── Native window drag via startWindowDragging() ─────────
// Called on mousedown on the drag area — no CSS regions needed.
// This is fire-and-forget so we use ipcMain.on (not handle).
ipcMain.on('start-drag', event => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.startWindowDragging()
})

// ── Scale: resize window to match card CSS scale ──────────
ipcMain.handle('scale-start', () => {
  if (!mainWin) return null
  const [x, y] = mainWin.getPosition()
  return { x, y }
})

ipcMain.handle('scale-end', (_, scale) => {
  if (!mainWin) return
  const clamped = Math.min(Math.max(scale, 0.5), 2.0)
  const newW    = Math.round(BASE_W * clamped)
  const newH    = Math.round(BASE_H * clamped)
  const [cx, cy] = mainWin.getPosition()
  const [ow, oh] = mainWin.getSize()
  mainWin.setSize(newW, newH)
  // Keep the card centred on its previous position
  mainWin.setPosition(
    Math.round(cx - (newW - ow) / 2),
    Math.round(cy - (newH - oh) / 2)
  )
})

ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true))
