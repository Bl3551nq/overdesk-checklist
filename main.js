const {
  app, BrowserWindow, Tray, Menu,
  ipcMain, ipcRenderer, nativeImage, screen
} = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

// ─── Env ────────────────────────────────────────────────
const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
const IS_DEV = !app.isPackaged

// Windows: set App User Model ID so taskbar shows the right icon at full size
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

// ─── Window state ───────────────────────────────────────
let tray    = null
let mainWin = null
let actWin  = null

// Card base dimensions at scale 1.0
const BASE_W = 380
const BASE_H = 640
// Max window size at scale 1.8 — transparent overflow is invisible
const MAX_W  = Math.ceil(BASE_W * 1.8) + 40   // 724
const MAX_H  = Math.ceil(BASE_H * 1.8) + 40   // 1192

// Drag state (for IPC-based window dragging)
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

// ─── Main app window ────────────────────────────────────
function createMainWin() {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  mainWin = new BrowserWindow({
    // Window is always MAX size — transparent overflow invisible
    // This lets CSS scale work without clipping
    width:           MAX_W,
    height:          MAX_H,
    x:               width - MAX_W - 20,
    y:               40,
    frame:           false,
    transparent:     true,
    backgroundColor: '#00000000',
    resizable:       false,
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

    // 1. Force transparent background
    mainWin.webContents.insertCSS(`
      html, body { background: transparent !important; margin: 0; padding: 0; }
      /* All elements: no CSS drag — we handle drag via IPC */
      * { -webkit-app-region: no-drag !important; }
    `)

    // 2. Wire up IPC drag from the drag-corner div
    //    Clone it first to strip any existing listeners the HTML attached
    mainWin.webContents.executeJavaScript(`
      (function(){
        /* ── Drag: replace drag-corner element to clear existing listeners ── */
        var dc = document.getElementById('drag-corner');
        if(dc && window.electronAPI){
          var fresh = dc.cloneNode(false);
          fresh.style.cssText = dc.style.cssText;
          dc.parentNode.replaceChild(fresh, dc);

          fresh.addEventListener('mousedown', function(e){
            if(e.button !== 0) return;
            window.electronAPI.dragStart(e.screenX, e.screenY);

            var onMove = function(ev){
              window.electronAPI.dragMove(ev.screenX, ev.screenY);
            };
            var onUp = function(){
              window.electronAPI.dragEnd();
              document.removeEventListener('mousemove', onMove, true);
              document.removeEventListener('mouseup',   onUp,   true);
            };
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup',   onUp,   true);
            e.preventDefault();
            e.stopImmediatePropagation();
          });
        }

        /* ── Scale: send real-time scale updates so window resizes during drag ── */
        var _lastScale = 1;
        var _scaleTick = null;
        document.addEventListener('mousemove', function(){
          if(typeof window._cardScale === 'undefined') return;
          if(window._cardScale === _lastScale) return;
          _lastScale = window._cardScale;
          if(!_scaleTick){
            _scaleTick = setTimeout(function(){
              _scaleTick = null;
              if(window.electronAPI) window.electronAPI.scaleMove(_lastScale);
            }, 32); // ~30fps max IPC rate
          }
        }, false);
      })();
    `)
  })

  if (IS_DEV) mainWin.webContents.openDevTools({ mode: 'detach' })
  mainWin.on('closed', () => { mainWin = null })
}

// ─── Tray ───────────────────────────────────────────────
function setupTray() {
  const raw = nativeImage.createFromPath(res('icon.png'))
  const img = raw.resize({ width: 16, height: 16 })
  if (IS_MAC) img.setTemplateImage(true)

  tray = new Tray(img)
  tray.setToolTip('Overdesk Checklist')

  const ctxMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (mainWin) mainWin.show(); else createMainWin() } },
    { label: 'Hide', click: () => { if (mainWin) mainWin.hide() } },
    { type: 'separator' },
    { label: 'Quit Overdesk', click: () => app.quit() },
  ])
  tray.setContextMenu(ctxMenu)
  tray.on('click', () => { if (mainWin) mainWin.isVisible() ? mainWin.hide() : mainWin.show() })
}

// ─── Auto-updater ───────────────────────────────────────
function setupUpdater() {
  if (IS_DEV) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-available',  info => { if (mainWin) mainWin.webContents.send('update-available',  info.version) })
  autoUpdater.on('update-downloaded', info => { if (mainWin) mainWin.webContents.send('update-downloaded', info.version) })
  autoUpdater.on('error', err => console.error('Updater:', err.message))
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}

// ─── App lifecycle ──────────────────────────────────────
app.whenReady().then(() => {
  if (IS_MAC) app.dock.hide()
  setupTray()
  setupUpdater()
  readLicense()?.key ? createMainWin() : createActivateWin()
})

app.on('window-all-closed', e => e.preventDefault())

// ─── IPC: Window drag ───────────────────────────────────
ipcMain.on('window-drag-start', (event, { x, y }) => {
  if (!mainWin) return
  _dragStartMouse = { x, y }
  _dragStartWin   = mainWin.getPosition()
})

ipcMain.on('window-drag-move', (event, { x, y }) => {
  if (!mainWin || !_dragStartMouse || !_dragStartWin) return
  const dx = x - _dragStartMouse.x
  const dy = y - _dragStartMouse.y
  mainWin.setPosition(
    _dragStartWin[0] + dx,
    _dragStartWin[1] + dy
  )
})

ipcMain.on('window-drag-end', () => {
  _dragStartMouse = null
  _dragStartWin   = null
})

// ─── IPC: Scale ─────────────────────────────────────────
ipcMain.handle('scale-start', () => {
  if (!mainWin) return
  return { pos: mainWin.getPosition() }
})

// Real-time scale during drag — window stays MAX_W x MAX_H,
// CSS transform handles all visual scaling. No resize needed.
ipcMain.on('scale-move', (event, scale) => {
  // No-op: window is pre-sized to MAX, CSS scale works within it
  // Kept for future use (e.g. haptic feedback, analytics)
})

ipcMain.handle('scale-end', (event, scale) => {
  // No-op: same reason — window is already max size
  // The CSS transform scale is saved to localStorage by the renderer
})

// ─── IPC: Other ─────────────────────────────────────────
ipcMain.handle('check-license',    ()      => ({ activated: !!readLicense()?.key }))
ipcMain.handle('activate-license', (_, k)  => { saveLicense(k); return { ok: true } })
ipcMain.handle('validate-license', (_, k)  => { saveLicense(k); return { ok: true } })

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

ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true))
