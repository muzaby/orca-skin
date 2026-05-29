import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IpcRouter } from './ipc/router'
import { PythonRuntime } from './runtime'
import { CHANNELS } from '../shared/ipc'
import type { SettingsStore } from './settings/store'

// `--prepare-runtime`: GUI 없이 Python(uv) 런타임만 준비하고 종료하는 헤드리스 모드.
// `npm run prepare-runtime` 이 main 번들 빌드 후 `electron . --prepare-runtime` 로 호출한다.
const PREPARE_ONLY = process.argv.includes('--prepare-runtime')

// renderer 번들 루트 — production 빌드에서 electron-vite 가 `out/renderer/` 에
// `index.html` + `assets/*` 을 산출한다. 본 모듈 위치(`out/main/index.js`) 기준 상대.
const RENDERER_DIST = join(__dirname, '../renderer')

// app:// 커스텀 스킴을 표준(standard) 스킴으로 사전 등록. 표준 스킴이라야
// `URL.pathname`, history `pushState`/`popstate`, BrowserRouter 가 일관 동작한다.
// 반드시 `app.ready` *이전* 에 호출돼야 효력 발생.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

// app://renderer/<path> 핸들러.
// - 디스크에 실존하는 자산 (확장자 보유 파일) → 그 파일을 그대로 서빙.
// - 그 외 모든 path (BrowserRouter 가 다루는 SPA 경로) → index.html 로 SPA fallback.
//   이 fallback 이 새로고침/직접 진입/딥링크의 핵심.
function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const decoded = decodeURIComponent(url.pathname)
    // `/foo/bar` → `foo/bar` 로 정규화 후 RENDERER_DIST 와 결합.
    const rel = decoded.replace(/^\/+/, '')
    const candidate = rel ? join(RENDERER_DIST, rel) : join(RENDERER_DIST, 'index.html')
    const isAsset = extname(candidate) !== ''
    const target = isAsset && existsSync(candidate) ? candidate : join(RENDERER_DIST, 'index.html')
    return net.fetch(pathToFileURL(target).toString())
  })
}

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
  // dev: Vite dev server (http://localhost:…) — BrowserRouter 가 history API 로 동작.
  // prod: app:// 커스텀 스킴 — 위에 등록한 protocol.handle 이 SPA fallback 을 수행해
  // BrowserRouter 의 deep URL 새로고침을 받쳐준다.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadURL('app://renderer/')
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  // 헤드리스 준비 모드: 윈도우/프로토콜/IpcRouter 부팅을 생략하고 런타임만 준비 후 종료.
  if (PREPARE_ONLY) {
    const rt = new PythonRuntime()
    rt.on('status', (st) => {
      if (st.stage === 'error') console.error('[runtime] error:', st.error)
      else console.log('[runtime]', st.stage, st.log ?? '')
    })
    await rt.ensure()
    app.exit(rt.status.stage === 'ready' ? 0 : 1)
    return
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 윈도우 생성 이전에 app:// 핸들러를 부착해 renderer 로딩이 바로 받쳐지도록.
  registerAppProtocol()

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
