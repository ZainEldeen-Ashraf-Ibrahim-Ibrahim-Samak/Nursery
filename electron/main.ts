// MUST be first: loads .env into process.env before any module reads it.
import { checkRequiredConfig } from './env.js'
import { app, BrowserWindow, protocol, net, dialog, ipcMain, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { initDb, closeDb } from './db/connection.js'
import { runMigrations } from './db/migrations/index.js'
import { seedDatabase } from './db/seed.js'

// Import IPC modules to register handlers
import './ipc/authIPC.js'
import './ipc/childrenIPC.js'
import './ipc/childServicesIPC.js'
import './ipc/teachersIPC.js'
import './ipc/paymentsIPC.js'
import './ipc/salariesIPC.js'
import './ipc/expensesIPC.js'
import './ipc/targetIPC.js'
import './ipc/settingsIPC.js'
import './ipc/brandingIPC.js'
import './ipc/exportIPC.js'
import './ipc/storageIPC.js'
import './ipc/syncIPC.js'
import './ipc/dashboardIPC.js'
import './ipc/rolesIPC.js'
import './ipc/salaryTypesIPC.js'
import './ipc/serviceDefinitionsIPC.js'
import './ipc/sessionsIPC.js'
import './ipc/attendanceIPC.js'
import './ipc/paymentMethodsIPC.js'
import './ipc/deductionsIPC.js'
import './ipc/serviceTeachersIPC.js'
import './ipc/teacherPaymentsIPC.js'
import './ipc/payrollIPC.js'
import './ipc/notificationsIPC.js'
import { startAutoSync, getMongoUri } from './ipc/syncIPC.js'
import { connectMongo } from './services/mongoSync.js'

// Get __dirname equivalent in ESM if needed
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Force HTTP/1.1 to avoid net::ERR_HTTP2_PROTOCOL_ERROR when downloading updates
// from GitHub CDN via electron-updater.
app.commandLine.appendSwitch('disable-http2')

// Register asset scheme before app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/branding/icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'نظام إدارة الحضانة ومركز التوحد | Nursery & Autism Center Management System',
  })

  // Surface any preload load/execution failure (otherwise window.api is silently undefined)
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('PRELOAD ERROR at', preloadPath, '->', error)
  })

  // Load URL or File
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Refuse to start a production build without a configured signing secret (FR-012).
  const configCheck = checkRequiredConfig()
  if (!configCheck.ok) {
    console.error('FATAL CONFIG ERROR:', configCheck.error)
    dialog.showErrorBox('Configuration Error / خطأ في الإعداد', configCheck.error || 'Invalid configuration')
    app.quit()
    return
  }

  // Initialize Database, run migrations and seed
  try {
    const db = initDb()
    runMigrations(db)
    await seedDatabase(db)
    console.log('Database initialized, migrated and seeded successfully!')

    // Check/copy default branding assets to userData/branding/
    const brandingDir = path.join(app.getPath('userData'), 'branding')
    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true })
    }

    const defaultLogoSrc = path.join(__dirname, '../assets/default-branding/logo.png')
    const defaultIconSrc = path.join(__dirname, '../assets/default-branding/icon.png')
    const destLogo = path.join(brandingDir, 'logo.png')
    const destIcon = path.join(brandingDir, 'icon.png')

    if (fs.existsSync(defaultLogoSrc) && !fs.existsSync(destLogo)) {
      fs.copyFileSync(defaultLogoSrc, destLogo)
    }
    if (fs.existsSync(defaultIconSrc) && !fs.existsSync(destIcon)) {
      fs.copyFileSync(defaultIconSrc, destIcon)
    }

    // Check/copy default fonts to userData/branding/fonts/
    const fontsDir = path.join(brandingDir, 'fonts')
    if (!fs.existsSync(fontsDir)) {
      fs.mkdirSync(fontsDir, { recursive: true })
    }

    const defaultFontRegularSrc = path.join(__dirname, '../assets/branding/fonts/Cairo-Regular.ttf')
    const defaultFontBoldSrc = path.join(__dirname, '../assets/branding/fonts/Cairo-Bold.ttf')
    const destFontRegular = path.join(fontsDir, 'Cairo-Regular.ttf')
    const destFontBold = path.join(fontsDir, 'Cairo-Bold.ttf')

    if (fs.existsSync(defaultFontRegularSrc) && !fs.existsSync(destFontRegular)) {
      fs.copyFileSync(defaultFontRegularSrc, destFontRegular)
    }
    if (fs.existsSync(defaultFontBoldSrc) && !fs.existsSync(destFontBold)) {
      fs.copyFileSync(defaultFontBoldSrc, destFontBold)
    }

    // Set paths in settings if they are currently empty
    const currentLogo = db.prepare("SELECT value FROM settings WHERE key = 'brand_logo_path'").get() as { value: string } | undefined
    if (!currentLogo || !currentLogo.value) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_logo_path', 'branding/logo.png')").run()
    }
    const currentIcon = db.prepare("SELECT value FROM settings WHERE key = 'brand_icon_path'").get() as { value: string } | undefined
    if (!currentIcon || !currentIcon.value) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_icon_path', 'branding/icon.png')").run()
    }
    // Seed MONGO_URI from env into settings DB if the admin hasn't set one yet.
    // This lets the admin see and change the URI in the Settings UI without
    // having to retype it. Admin-configured values are never overwritten.
    const envMongoUri = process.env.MONGO_URI?.trim()
    if (envMongoUri) {
      const existingUri = db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get() as { value: string } | undefined
      if (!existingUri) {
        // Row doesn't exist yet — insert it
        db.prepare(`
          INSERT INTO settings (key, value, updated_at, synced)
          VALUES ('sync_mongo_uri', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
        `).run(envMongoUri)
        console.log('[startup] Seeded MONGO_URI from env into settings.')
      } else if (!existingUri.value) {
        // Row exists but value is empty — update it
        db.prepare(`
          UPDATE settings SET value = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), synced = 0
          WHERE key = 'sync_mongo_uri'
        `).run(envMongoUri)
        console.log('[startup] Updated empty sync_mongo_uri from env.')
      }
    }

    // Connect to MongoDB on startup if URI is configured
    const mongoUri = getMongoUri()
    if (mongoUri) {
      console.log('Connecting to MongoDB on startup...')
      connectMongo(mongoUri)
        .then(() => console.log('Successfully connected to MongoDB on startup.'))
        .catch((err) => console.error('Failed to connect to MongoDB on startup:', err.message))
    }

    // Resume auto-sync if a saved interval exists (T090)
    const autoIntervalRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_interval'").get() as { value: string } | undefined
    const savedInterval = Number(autoIntervalRow?.value ?? 0)
    if (savedInterval > 0) {
      startAutoSync(savedInterval * 60 * 1000)
    }
  } catch (error) {
    console.error('Failed to initialize database or branding assets:', error)
  }

  // Register asset:// protocol handler to safely load branding assets
  protocol.handle('asset', (request) => {
    try {
      const urlPath = decodeURIComponent(request.url.slice('asset://'.length))
      const cleanPath = urlPath.replace(/^\/+/, '')
      const absolutePath = path.isAbsolute(cleanPath) 
        ? cleanPath 
        : path.join(app.getPath('userData'), cleanPath)
        
      return net.fetch(pathToFileURL(absolutePath).toString())
    } catch (err) {
      console.error('Asset protocol error:', err)
      return new Response('Asset not found', { status: 404 })
    }
  })

  createWindow()

  // Auto-updater only runs in packaged production builds.
  // In dev mode electron-updater has no feed URL and would throw.
  if (app.isPackaged) {
    initAutoUpdater()
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('Error during automatic update check:', err)
      })
    }, 5000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function initAutoUpdater() {
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:status', { event: 'checking-for-update' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:status', { event: 'update-available', info })
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater:status', { event: 'update-not-available', info })
  })

  let _updateRetried = false
  autoUpdater.on('error', (err) => {
    const msg = err.message || ''
    const isRateLimit = msg.includes('429') || msg.includes('Too Many Requests')
    const isNetworkError = !isRateLimit && (msg.includes('ERR_HTTP2') || msg.includes('net::') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT'))

    if (isNetworkError && !_updateRetried) {
      _updateRetried = true
      setTimeout(() => autoUpdater.downloadUpdate().catch(() => {}), 3000)
      return
    }

    mainWindow?.webContents.send('updater:status', {
      event: 'error',
      error: isRateLimit ? '429' : msg,
      errorCode: isRateLimit ? 'rate_limit' : isNetworkError ? 'network' : 'unknown',
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater:status', {
      event: 'download-progress',
      progress: {
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      }
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:status', { event: 'update-downloaded', info })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
    return { success: true }
  })

  ipcMain.handle('updater:open-release-page', () => {
    shell.openExternal('https://github.com/ZainEldeen-Ashraf-Ibrahim-Ibrahim-Samak/Nursery/releases/latest')
  })
}

process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
