const {
  app, BrowserWindow, Tray, Menu,
  ipcMain, nativeImage, screen
} = require('electron')

const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

// ─── Env ────────────────────────────────────────────────
const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
const IS_DEV = !app.isPackaged

// ─── Paths ──────────────────────────────────────────────
const USERDATA     = app.getPath('userData')
const LICENSE_FILE = path.join(USERDATA, 'license.json')

// Owner bypass — never share this key
const OWNER_KEY = 'OVERDESK-OWNER-BL3551NQ-2025';

/** Resolve a runtime asset: dev = ./build/, packaged = resources/ */
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

// ─── Gumroad Verification ───────────────────────────────
async function verifyWithGumroad(key) {

  // Owner bypass
  if (key === OWNER_KEY) {
    return {
      ok: true,
      owner: true
    }
  }

  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: 'YOUR_GUMROAD_PRODUCT_ID',
        license_key: key,
        increment_uses_count: false
      })
    })

    const data = await response.json()

    if (data.success) {
      return {
        ok: true,
        buyer: data.purchase?.email || null
      }
    }

    return {
      ok: false,
      error: 'Invalid license key'
    }

  } catch (err) {
    console.error('Gumroad verification failed:', err)

    return {
      ok: false,
      error: 'Verification server error'
    }
  }
}

// ─── State ──────────────────────────────────────────────
let tray    = null
let mainWin = null
let actWin  = null

// ─── Activation window ──────────────────────────────────
function createActivateWin() {
  actWin = new BrowserWindow({
    width:       420,
    height:      600,
    frame:       false,
    transparent: true,
    resizable:   false,
    alwaysOnTop: true,
    center:      true,
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
    width:       380,
    height:      640,
    x:           width - 420,
    y:           60,
    frame:       false,
    transparent: true,
    resizable:   false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow:   true,
    webPreferences: {
      preload:          path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })

  mainWin.loadFile(path.join(__dirname, 'src', 'checklist.html'))

  mainWin.webContents.on('did-finish-load', () => {

    mainWin.webContents.insertCSS(`
      #card { -webkit-app-region: drag; }

      button, input, select, textarea, a, label,
      #options-list, .opt, .left-handle, .minimize-pill,
      .mode-btn, .icon-btn, .theme-btn, .close-btn,
      .picker-overlay, .picker-inner, [onclick], [oninput] {
        -webkit-app-region: no-drag;
      }
    `)

    mainWin.webContents.executeJavaScript(`
      (function () {
        var card = document.getElementById('card');

        if (!card) return;

        card.style.transform = 'none';

        card.addEventListener('mousedown', function (e) {

          var skip = e.target.closest(
            'button, input, select, a, label, ' +
            '#options-list, .opt, .left-handle, .minimize-pill, ' +
            '.mode-btn, .icon-btn, .theme-btn, .close-btn, .picker-overlay'
          );

          if (!skip) e.stopImmediatePropagation();

        }, true);

      })();
    `)

  })

  if (IS_DEV) {
    mainWin.webContents.openDevTools({ mode: 'detach' })
  }

  mainWin.on('closed', () => {
    mainWin = null
  })
}

// ─── Tray ────────────────────────────────────────────────
function setupTray() {

  const raw = nativeImage.createFromPath(res('icon.png'))
  const img = raw.resize({ width: 16, height: 16 })

  if (IS_MAC) {
    img.setTemplateImage(true)
  }

  tray = new Tray(img)

  tray.setToolTip('Overdesk Checklist')

  const ctxMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWin) mainWin.show()
        else createMainWin()
      }
    },
    {
      label: 'Hide',
      click: () => {
        if (mainWin) mainWin.hide()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Overdesk',
      click: () => app.quit()
    },
  ])

  tray.setContextMenu(ctxMenu)

  tray.on('click', () => {
    if (mainWin) {
      mainWin.isVisible() ? mainWin.hide() : mainWin.show()
    }
  })

  tray.on('double-click', () => {
    if (mainWin) mainWin.show()
  })
}

// ─── Auto-updater config ─────────────────────────────────
function setupUpdater() {

  if (IS_DEV) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', info => {
    if (mainWin) {
      mainWin.webContents.send('update-available', info.version)
    }
  })

  autoUpdater.on('update-downloaded', info => {
    if (mainWin) {
      mainWin.webContents.send('update-downloaded', info.version)
    }
  })

  autoUpdater.on('error', err => {
    console.error('Updater error:', err.message)
  })

  autoUpdater.checkForUpdates()

  setInterval(() => {
    autoUpdater.checkForUpdates()
  }, 4 * 60 * 60 * 1000)
}

// ─── App lifecycle ───────────────────────────────────────
app.whenReady().then(() => {

  if (IS_MAC) {
    app.dock.hide()
  }

  setupTray()
  setupUpdater()

  if (readLicense()?.key) {
    createMainWin()
  } else {
    createActivateWin()
  }

})

// Keep alive in tray when all windows close
app.on('window-all-closed', e => e.preventDefault())

// ─── IPC ─────────────────────────────────────────────────
ipcMain.handle('check-license', () => ({
  activated: !!readLicense()?.key
}))

ipcMain.handle('activate-license', async (_, key) => {

  const result = await verifyWithGumroad(key)

  if (result.ok) {
    saveLicense(key)
  }

  return result
})

ipcMain.handle('validate-license', async (_, key) => {

  const result = await verifyWithGumroad(key)

  if (result.ok) {
    saveLicense(key)
  }

  return result
})

ipcMain.handle('launch-app', () => {

  if (actWin) {
    actWin.close()
    actWin = null
  }

  createMainWin()

})

ipcMain.handle('close-app', event => {

  const win = BrowserWindow.fromWebContents(event.sender)

  if (win) {
    win.hide()
  }

})

ipcMain.handle('set-always-on-top', (_, flag) => {
  if (mainWin) {
    mainWin.setAlwaysOnTop(flag, 'floating')
  }
})

ipcMain.handle('scale-end', (_, scale) => {

  if (!mainWin) return

  const base = {
    w: 380,
    h: 640
  }

  const clamped = Math.min(Math.max(scale, 0.7), 1.4)

  mainWin.setSize(
    Math.round(base.w * clamped),
    Math.round(base.h * clamped)
  )

})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true)
})
