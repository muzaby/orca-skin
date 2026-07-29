import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'
import { Bootstrap } from './app/bootstrap'
import { closeDb } from './infra/db'
import { closeLog, flushLogSync, getLogger, initLog } from './infra/log'
import { devUserDataDir } from './infra/config/paths'
import { CHANNELS } from '../shared/ipc'
import type { SettingsStore } from './infra/settings-store'

// dev(`npm run dev`) 데이터를 실제 설치본과 격리한다. userData 는 app.getName()(dev·prod 모두 `orca`)
// 에서 파생돼 같은 폴더로 해석되므로, dev 에서만 sibling `orca-dev` 로 리디렉션한다. 이후 DB·WAL·
// 마이그레이션 백업·secret-store 가 모두 이 폴더 아래로 격리된다(하위 코드는 getPath('userData') 만 참조).
// app.setPath('userData') 는 app.whenReady() *이전* 에 호출돼야 하므로 이 모듈 스코프에 둔다. prod
// 번들에선 import.meta.env.DEV 상수 치환으로 이 블록이 dead-code 제거된다.
if (import.meta.env.DEV) {
  app.setPath('userData', devUserDataDir(app.getPath('appData')))
}

// 로깅 싱글턴 초기화 (0123) — userData 리다이렉트 *이후*·다른 모든 배선 이전. 파일은
// <userData>/logs/ 라 dev/prod 가 자동 격리된다. 이후 전역 장애 훅이 이 로거를 쓴다.
const rootLog = initLog()

// will-quit(모듈 스코프)에서 종료 정리를 호출하기 위한 라우터 참조. whenReady 에서 채워진다.
let routerRef: Bootstrap | null = null

// second-instance 핸들러가 포커스할 메인 창 참조. createWindow 에서 채우고 closed 에서 비운다.
let mainWindowRef: BrowserWindow | null = null

// 단일 인스턴스 강제 — 패키징 빌드 한정. 이미 실행 중인 인스턴스가 있으면 락 획득에 실패하고
// 두 번째 프로세스는 아래 app.quit() 으로 즉시 종료된다. dev(electron-vite HMR 재시작)에서는
// 이전 프로세스가 락을 늦게 놓으면 새 인스턴스가 즉시 종료되는 경합이 생기므로 제외한다.
const hasSingleInstanceLock = app.isPackaged ? app.requestSingleInstanceLock() : true
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  // 두 번째 실행 시도 시: 새 창을 띄우지 않고 기존 창을 복원·포커스한다.
  app.on('second-instance', () => {
    focusMainWindow()
  })
}

// 기존 창을 전면으로. 최소화 상태면 복원하고, 숨겨져 있으면 표시한 뒤 포커스한다.
function focusMainWindow(): void {
  const win = mainWindowRef ?? BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// 전역 미처리 예외 가드. Claude SDK 가 claude CLI 서브프로세스 stdin 으로 user 메시지를
// 쓰다 실패하는 비동기 에러(예: 큰 이미지 첨부 전송 중 'write EOF at
// WriteWrap.onWriteComplete')는 어댑터의 턴 try/catch 밖(SDK 소유 write 경로)이라 잡히지
// 않는다. 핸들러가 없으면 Electron 기본 네이티브 에러창이 떠 UX 를 깨므로, 여기서 로깅으로
// 흡수해 다이얼로그/크래시를 막는다(동작 보존 — 0123 에서 console → 로거 교체). 파일 로그가
// 항상 남고 dev 는 콘솔 미러가 받는다. fatal 경로는 즉시 flush 해 버퍼 유실을 막는다.
process.on('unhandledRejection', (reason) => {
  rootLog.error('app.unhandled.rejection', reason)
  flushLogSync()
})
process.on('uncaughtException', (err) => {
  rootLog.error('app.uncaught.exception', err)
  flushLogSync()
})

// 프로세스 장애 수집 (0123 AC8) — renderer/child 비정상 종료를 원인·windowId 와 함께 기록.
app.on('render-process-gone', (_event, contents, details) => {
  rootLog.error('app.renderer.gone', undefined, {
    reason: details.reason,
    exitCode: details.exitCode,
    windowId: contents.id
  })
  flushLogSync()
})
app.on('child-process-gone', (_event, details) => {
  rootLog.error('app.child-process.gone', undefined, {
    processType: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    name: details.name
  })
  flushLogSync()
})

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
    // 실행 중 창/작업표시줄 아이콘. Windows 는 다해상도 투명 .ico, Linux 는 png.
    // dev 에서 electron.exe 기본(시스템) 아이콘을 대체한다. packaged .exe 파일 아이콘은
    // electron-builder 가 build/icon.ico 로 별도 설정하는 별개 경로. macOS dock 은
    // 앱 번들 아이콘을 따르므로(BrowserWindow.icon 무효) 미설정.
    ...(process.platform === 'win32'
      ? { icon: iconIco }
      : process.platform === 'linux'
        ? { icon }
        : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // second-instance 포커스가 집을 수 있도록 창 참조를 보관하고, 닫히면 비운다.
  mainWindowRef = mainWindow
  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) mainWindowRef = null
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

  // webContents 장애 수집 (0123 AC8) — 응답 없음·preload 실패·로드 실패.
  const windowLog = getLogger().child('window')
  const windowId = mainWindow.webContents.id
  mainWindow.webContents.on('unresponsive', () => {
    windowLog.error('window.webcontents.unresponsive', undefined, { windowId })
    flushLogSync()
  })
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    windowLog.error('window.preload.failed', error, { windowId, preloadPath })
    flushLogSync()
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    // -3(ERR_ABORTED) 은 정상 네비게이션 중단 — 장애가 아니므로 기록하지 않는다.
    if (errorCode === -3) return
    windowLog.error('window.load.failed', undefined, { windowId, errorCode, errorDescription })
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
  // 락을 얻지 못한(종료 중인) 두 번째 인스턴스는 창/Bootstrap 을 만들지 않는다.
  if (!hasSingleInstanceLock) return

  electronApp.setAppUserModelId('com.orca.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 윈도우 생성 이전에 app:// 핸들러를 부착해 renderer 로딩이 바로 받쳐지도록.
  registerAppProtocol()

  const router = new Bootstrap()
  routerRef = router
  // 창 먼저(0109) — start() 의 DB 마이그레이션/스킬 시드/확장 배포를 기다리지 않고 셸을
  // 띄운다. renderer 부트 오케스트레이터의 첫 스텝(main-ready)이 이 게이트 invoke 로 완료를
  // 대기하므로 "미등록 핸들러 invoke" 창이 구조적으로 닫힌다. 게이트 핸들러는 start() 호출
  // 이전에 등록돼야 한다(등록 전 도착 invoke 는 reject 되므로).
  const started = router.start()
  ipcMain.handle(CHANNELS.bootWhenReady, () => started)
  createWindow(router.settings)
  try {
    await started
  } catch (err) {
    // 창은 이미 떠 있다 — 실패는 renderer 의 main-ready 필수 스텝(failed UX)으로 표면화된다.
    rootLog.error('app.start.failed', err)
    flushLogSync()
    return
  }
  rootLog.info('app.start.completed')
  void router.runBackgroundUpdateCheck()

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

// 종료 직전 정리 — ① 진행 중 턴의 열린 도구를 'aborted' 로 정착 + SDK abort(shutdown), ② 로그
// flush+close(0123 AC9 — shutdown 중 로그까지 담고 닫는다), ③ DB close(WAL 체크포인트).
// 순서 중요: persist 가 closeDb 전에 끝나야 한다(모두 동기).
app.on('will-quit', () => {
  // app.quit.started 는 flush(closeLog) *이전* 에 emit 돼야 파일에 남는다(0123 AC9 정합).
  rootLog.info('app.quit.started')
  routerRef?.shutdown()
  closeLog()
  closeDb()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
