const {
  app, BrowserWindow, Tray, Menu,
  ipcMain, nativeImage, screen
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

// ─── Constants ──────────────────────────────────────────
const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
const IS_DEV = !app.isPackaged

// Windows taskbar: must be set before app.whenReady
if (IS_WIN) app.setAppUserModelId('app.overdesk.checklist')

// ─── Paths ──────────────────────────────────────────────
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

// ─── Window dimensions ──────────────────────────────────
// Window is always MAX size so CSS scale never clips content.
// Transparent overflow is invisible — only the card shadow shows.
const BASE_W = 380
const BASE_H = 640
const MAX_W  = Math.ceil(BASE_W * 1.8) + 60   // 744
const MAX_H  = Math.ceil(BASE_H * 1.8) + 60   // 1212

// ─── State ──────────────────────────────────────────────
let tray    = null
let mainWin = null
let actWin  = null

// IPC drag state
let _dragStartMouse = null
let _dragStartWin   = null

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

// ─── Main widget window ─────────────────────────────────
function createMainWin() {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  mainWin = new BrowserWindow({
    width:           MAX_W,
    height:          MAX_H,
    x:               width - MAX_W - 20,
    y:               40,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    resizable:       false,
    alwaysOnTop:     true,
    skipTaskbar:     false,   // show in taskbar
    hasShadow:       false,   // card draws its own shadow
    icon:            res('icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })

  mainWin.loadFile(path.join(__dirname, 'src', 'checklist.html'))

  mainWin.webContents.on('did-finish-load', () => {
    // Force fully transparent window background
    mainWin.webContents.insertCSS(`
      html, body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      /* Disable all CSS drag — handled via IPC below */
      * { -webkit-app-region: no-drag !important; }
    `)

    // Wire IPC-based window drag from the drag-corner element
    // Clone to remove any JS listeners the HTML added
    mainWin.webContents.executeJavaScript(`
      (function(){
        var dc = document.getElementById('drag-corner');
        if (!dc || !window.electronAPI) return;

        var fresh = dc.cloneNode(false);
        fresh.className = dc.className;
        fresh.id = dc.id;
        dc.parentNode.replaceChild(fresh, dc);

        fresh.addEventListener('mousedown', function(e) {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          window.electronAPI.dragStart(e.screenX, e.screenY);

          function onMove(ev) {
            window.electronAPI.dragMove(ev.screenX, ev.screenY);
          }
          function onUp() {
            window.electronAPI.dragEnd();
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('mouseup',   onUp,   true);
          }
          document.addEventListener('mousemove', onMove, true);
          document.addEventListener('mouseup',   onUp,   true);
        });
      })();
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

  const menu = Menu.buildFromTemplate([
    { label: 'Show',  click: () => { if (mainWin) mainWin.show();  else createMainWin() } },
    { label: 'Hide',  click: () => { if (mainWin) mainWin.hide() } },
    { type: 'separator' },
    { label: 'Quit',  click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (!mainWin) return
    mainWin.isVisible() ? mainWin.hide() : mainWin.show()
  })
}

// ─── Auto-updater ────────────────────────────────────────
function setupUpdater() {
  if (IS_DEV) return
  autoUpdater.autoDownload         = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-available',  info => {
    if (mainWin) mainWin.webContents.send('update-available',  info.version)
  })
  autoUpdater.on('update-downloaded', info => {
    if (mainWin) mainWin.webContents.send('update-downloaded', info.version)
  })
  autoUpdater.on('error', err => console.error('Updater error:', err.message))
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

// Keep running in tray when windows close
app.on('window-all-closed', e => e.preventDefault())

// ─── IPC: Drag ───────────────────────────────────────────
ipcMain.on('window-drag-start', (_, { x, y }) => {
  if (!mainWin) return
  _dragStartMouse = { x, y }
  _dragStartWin   = mainWin.getPosition()
})
ipcMain.on('window-drag-move', (_, { x, y }) => {
  if (!mainWin || !_dragStartMouse || !_dragStartWin) return
  mainWin.setPosition(
    _dragStartWin[0] + (x - _dragStartMouse.x),
    _dragStartWin[1] + (y - _dragStartMouse.y)
  )
})
ipcMain.on('window-drag-end', () => {
  _dragStartMouse = null
  _dragStartWin   = null
})

// ─── IPC: Scale ──────────────────────────────────────────
// Window is pre-sized to MAX — CSS transform handles all scaling.
// No window resize needed; scale is saved to localStorage by renderer.
ipcMain.handle('scale-start', () => {
  if (mainWin) return { pos: mainWin.getPosition() }
})
ipcMain.handle('scale-end', () => {})
ipcMain.on('scale-move',     () => {})

// ─── IPC: License ────────────────────────────────────────
ipcMain.handle('check-license',    ()     => ({ activated: !!readLicense()?.key }))
ipcMain.handle('activate-license', (_, k) => { saveLicense(k); return { ok: true } })
ipcMain.handle('validate-license', (_, k) => { saveLicense(k); return { ok: true } })

// ─── IPC: Window ─────────────────────────────────────────
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

// ─── IPC: Updater ────────────────────────────────────────
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true))
