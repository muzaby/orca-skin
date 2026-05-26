import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IpcRouter } from './ipc/router'
import { CHANNELS } from '../shared/ipc'
import type { SettingsStore } from './settings/store'

const DEFAULT_BOUNDS = { width: 900, height: 670 }

function createWindow(settings: SettingsStore): void {
  const saved = settings.getAll().windowBounds
  // 커스텀 타이틀바 — HTML 헤더로 직접 그린다. macOS 는 traffic light 만 OS 가
  // 그리도록 `titleBarStyle: 'hidden'` + `trafficLightPosition` 으로 36px 헤더 안에
  // 수직 중앙. Windows/Linux 는 frameless, WinControls 가 minimize/maximize/close 를 그린다.
  const mainWindow = new BrowserWindow({
    ...DEFAULT_BOUNDS,
    ...(saved ?? {}),
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 12, y: 10 } }
      : {}),
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

  // 커스텀 타이틀바의 minimize/maximize/close 버튼이 호출하는 IPC. 인자 없음, void 반환.
  // 채널은 mainWindow 마다 등록되는 것이 아니라 ipcMain 글로벌이라 createWindow 안에서
  // 한 번만 부착. 다중 윈도우 도입 시 router 로 옮긴다.
  const bindWindowControls = (): void => {
    ipcMain.handle(CHANNELS.windowMinimize, () => {
      mainWindow.minimize()
    })
    ipcMain.handle(CHANNELS.windowMaximize, () => {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      else mainWindow.maximize()
    })
    ipcMain.handle(CHANNELS.windowClose, () => {
      mainWindow.close()
    })
  }
  bindWindowControls()

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
