import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IpcRouter } from './ipc/router'
import type { SettingsStore } from './settings/store'

const DEFAULT_BOUNDS = { width: 900, height: 670 }

function createWindow(settings: SettingsStore): void {
  const saved = settings.getAll().windowBounds
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    ...DEFAULT_BOUNDS,
    ...(saved ?? {}),
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 종료 직전 윈도우 위치/크기를 영속화. minimize/maximize 상태는 보존 대상 아님.
  mainWindow.on('close', () => {
    if (mainWindow.isMinimized() || mainWindow.isMaximized()) return
    settings.patch({ windowBounds: mainWindow.getBounds() })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const router = new IpcRouter()
  await router.start()

  createWindow(router.settings)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(router.settings)
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
