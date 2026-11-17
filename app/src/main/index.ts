import { registerNativeSettingsQuit } from './app/native-settings-lifecycle'
import { installTrayResidency } from './app/tray-residency'
import {
  app,
  shell,
  BrowserWindow,
  protocol,
  net,
  Tray,
  Menu,
  nativeImage,
  powerMonitor,
  MessageChannelMain,
  type MessagePortMain
} from 'electron'
import { installExternalNavigation } from './infra/external-navigation'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import logo from '../../resources/logo.png?asset'
import { registerLogHandlers } from './app/handlers/log'
import { registerUpdateHandlers } from './app/handlers/update'
import { reportError } from './infra/error-report'
import { createArtifactSenderCheck } from './app/artifact-sender'
import { closeLog, flushLogSync, getLogger, initLog } from './infra/log'
import { handle, handlePlain } from './infra/ipc/handle'
import { createElectronTransport } from './infra/ipc/electron-transport'
import { setIpcTransport } from './infra/ipc/transport'
import { startLoopStallMonitor } from './infra/perf/stall-monitor'
import { devUserDataDir } from './infra/config/paths'
import { killPidTree, listProcesses } from './infra/shell/shell-runner'
import { CHANNELS } from '../shared/ipc'
import { NotifyShowSchema } from '../shared/protocol'
import { APP_USER_MODEL_ID, PRODUCT_DISPLAY_NAME } from '../shared/product'
import type { ShellState } from './app/shell/shell-state'
import { createElectronShellServices } from './app/shell/electron-services'
import { createHostMessageSink, hostStartStep } from './app/shell/host-link'
import { createShellServiceServer } from './app/shell/services'
import { createHostBoot, type HostKind } from './app/shell/boot'
import { attachHostPorts, forkHost } from './app/shell/electron-hosts'
import {
  HOST_READY_TIMEOUT_MS,
  createHostSupervisor,
  type HostSupervisor
} from './app/shell/host-supervisor'
import { setHostEnvironment, type HostEnvironment } from './infra/host-environment'
import { LifecycleState } from './app/shell/lifecycle-state'
import { openShellState } from './app/shell/shell-state-file'
import { createNoopUpdater, loadElectronAutoUpdater, UpdateController } from './app/updater'

// dev(`npm run dev`) 데이터를 실제 설치본과 격리한다. userData 는 app.getName()(dev·prod 모두
// `orcinus-orca`)에서 파생돼 같은 폴더로 해석되므로, dev 에서만 sibling `orcinus-orca-dev` 로
// 리디렉션한다. 이후 DB·WAL·
// 마이그레이션 백업·secret-store 가 모두 이 폴더 아래로 격리된다(하위 코드는 getPath('userData') 만 참조).
// app.setPath('userData') 는 app.whenReady() *이전* 에 호출돼야 하므로 이 모듈 스코프에 둔다. prod
// 번들에선 import.meta.env.DEV 상수 치환으로 이 블록이 dead-code 제거된다.
if (import.meta.env.DEV) {
  app.setPath('userData', devUserDataDir(app.getPath('appData')))
}

// 로깅 싱글턴 초기화 (0123) — userData 리다이렉트 *이후*·다른 모든 배선 이전이다.
// 두 호스트가 읽는 경로·버전은 fork 인자로 간다(0324 §11 단계 4). 셸도 같은 값을 쓴다(로그 폴더).
const hostEnvironmentValue: HostEnvironment = {
  userData: app.getPath('userData'),
  desktop: app.getPath('desktop'),
  appVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  appPath: app.getAppPath()
}
setHostEnvironment(hostEnvironmentValue)
const rootLog = initLog()

// second-instance 핸들러가 포커스할 메인 창 참조. createWindow 에서 채우고 closed 에서 비운다.
let mainWindowRef: BrowserWindow | null = null
const rendererUrl =
  is.dev && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL']
    : 'app://renderer/'

// 셸이 처리하는 요청·통지의 전송(0324 EP-8′) — 창 조작·부팅 대기·업데이트·renderer 로그·알림만
// 셸 몫이다. 나머지 채널은 renderer 전송층이 호스트 포트로 보낸다(0324 D-058).
setIpcTransport(
  createElectronTransport({
    isTrusted: createArtifactSenderCheck(() => mainWindowRef?.webContents ?? null, rendererUrl)
  })
)
registerLogHandlers()
// 셸 이벤트 루프의 멈춤을 `perf.stall` 로 남긴다 (0324 AC5′). 로거가 준비된 직후에 켠다.
startLoopStallMonitor('main')

// will-quit·before-quit(모듈 스코프)에서 호스트 종료를 부르기 위한 참조. whenReady 에서 채워진다.
let hostBootRef: ReturnType<typeof createHostBoot<MessagePortMain>> | null = null

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
  reportError({
    event: 'app.unhandled.rejection',
    scope: 'app',
    title: 'unexpected',
    level: 'error',
    error: reason
  })
  flushLogSync()
})
process.on('uncaughtException', (err) => {
  reportError({
    event: 'app.uncaught.exception',
    scope: 'app',
    title: 'unexpected',
    level: 'error',
    error: err
  })
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

function createWindow(shellState: ShellState): BrowserWindow {
  const saved = shellState.windowBounds()
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
    // 실행 중 창/작업표시줄 아이콘. Windows·Linux 모두 같은 png 를 쓴다(0227 — .ico 자산 제거).
    // dev 에서 electron.exe 기본(시스템) 아이콘을 대체한다. packaged .exe 파일 아이콘은
    // electron-builder 가 build/logo.png 로 별도 설정하는 별개 경로. macOS dock 은
    // 앱 번들 아이콘을 따르므로(BrowserWindow.icon 무효) 미설정.
    ...(process.platform === 'win32' || process.platform === 'linux' ? { icon: logo } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // production 빌드에서는 상수 false 로 접혀 메뉴·단축키·openDevTools 가 모두 무효다(0261 D-002·D-003).
      // 모든 창 생성자가 이 키를 갖는지는 infra/browser-window-devtools.test.ts 가 강제한다.
      devTools: import.meta.env.DEV
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
    shellState.saveWindowBounds(mainWindow.getBounds())
  })

  installExternalNavigation(mainWindow.webContents, (url) => shell.openExternal(url))

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
    handlePlain(CHANNELS.windowMinimize, () => {
      mainWindow.minimize()
    })
    handlePlain(CHANNELS.windowMaximize, () => {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      else mainWindow.maximize()
    })
    handlePlain(CHANNELS.windowClose, () => {
      mainWindow.close()
    })
  }
  bindWindowControls()

  // HMR for renderer base on electron-vite cli.
  // dev: Vite dev server (http://localhost:…) — BrowserRouter 가 history API 로 동작.
  // prod: app:// 커스텀 스킴 — 위에 등록한 protocol.handle 이 SPA fallback 을 수행해
  // BrowserRouter 의 deep URL 새로고침을 받쳐준다.
  mainWindow.loadURL(rendererUrl)
  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // 락을 얻지 못한(종료 중인) 두 번째 인스턴스는 창·호스트를 만들지 않는다.
  if (!hasSingleInstanceLock) return

  electronApp.setAppUserModelId(APP_USER_MODEL_ID)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 윈도우 생성 이전에 app:// 핸들러를 부착해 renderer 로딩이 바로 받쳐지도록.
  registerAppProtocol()

  // 셸이 쓰는 상태는 셸 상태 파일 하나다(0324 D-029). UI 언어는 설정이 정본이고 여기는 사본이다.
  const shellState = openShellState(app.getPath('userData'))
  // 셸은 턴·세션 상태를 에이전트 호스트가 보낸 수명 이벤트로만 안다(0324 EP-11).
  const lifecycleState = new LifecycleState()
  // 셸 서비스(0324 EP-10) — 두 호스트가 Electron 권한 작업을 이 구현에 부탁한다.
  const shellServiceImpl = createElectronShellServices()
  const onShellServiceError = (name: string, error: unknown): void =>
    rootLog.warn('shell.service.failed', { name, error: String(error) })
  const supervisors: Partial<Record<HostKind, HostSupervisor<MessagePortMain>>> = {}
  let dataReady = false

  // 업데이트는 셸이 소유한다. 재시작 게이트는 수명 이벤트로 만든 상태만 본다(AC28 · VP-31).
  const updates = new UpdateController({
    updater:
      loadElectronAutoUpdater({ reportUnavailable: hostEnvironmentValue.isPackaged }) ??
      createNoopUpdater(),
    restartGateState: () => ({
      isGenerating: lifecycleState.hasActiveTurns(),
      activeToolCallCount: 0,
      // 데이터 호스트가 준비 전이면 마이그레이션·백업 중일 수 있다.
      activeDbWriteCount: dataReady ? 0 : 1,
      isIndexing: false
    }),
    prepareForUpdateInstall: () => {
      supervisors.agent?.post({ type: 'update.prepare-install' })
    }
  })
  lifecycleState.onChange(() => updates.refreshGate())
  registerUpdateHandlers({ updates })
  // 알림 — 포커스 판정은 셸만 한다(창 id 는 요청을 보낸 창이다).
  handle(CHANNELS.notifyShow, NotifyShowSchema, 'reject', async (req, event): Promise<void> => {
    await shellServiceImpl['notify.show'](
      { clientId: event.sender.id, title: req.title, body: req.body },
      { notifyLoginNavigated: () => {} }
    )
  })

  const boot = createHostBoot<MessagePortMain>({
    createChannel: () => new MessageChannelMain(),
    // 에이전트 호스트 비정상 종료의 마지막 단계 — 수명 상태를 비운다(AC29′).
    onAgentExited: () => lifecycleState.clear(),
    createSupervisor: (kind, hooks) => {
      const supervisor: HostSupervisor<MessagePortMain> = createHostSupervisor<MessagePortMain>({
        fork: () => forkHost(kind, join(__dirname, `${kind}-host.js`), hostEnvironmentValue),
        createChannel: () => new MessageChannelMain(),
        clock: {
          setTimeout: (callback, ms) => setTimeout(callback, ms),
          clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
        },
        isReady: (message) => (message as { type?: unknown } | null)?.type === 'ready',
        // 끝나지 않는 기동이 부팅을 막지 않는다(D-055 · AC50) — DB 단계는 데이터 호스트가 알려 세지 않는다.
        readyTimeoutMs: HOST_READY_TIMEOUT_MS,
        startStep: hostStartStep,
        onReadyTimeout: () =>
          rootLog.warn('shell.host.ready-timeout', {
            host: kind,
            timeoutMs: HOST_READY_TIMEOUT_MS
          }),
        onHostMessage: createHostMessageSink({
          lifecycle: lifecycleState,
          mirrorUiLocale: (uiLocale) => shellState.mirrorUiLocale(uiLocale),
          ...(kind === 'data'
            ? {
                onPeerEnsure: () => boot.peerEnsure(),
                onUpdateCheck: () => void updates.check(true)
              }
            : {}),
          // 셸 서비스 응답은 기동 중에도 그 호스트에 간다(비밀 해제가 준비 전에 돈다).
          onServiceCall: createShellServiceServer({
            impl: shellServiceImpl,
            reply: (message) => {
              supervisor.send(message)
            },
            onError: onShellServiceError
          }),
          onInvalid: () => rootLog.warn('shell.host-message.invalid', { host: kind })
        }),
        // 죽은 에이전트 호스트가 남긴 하네스·도구 프로세스를 끝낸다(EP-12).
        ...(kind === 'agent'
          ? {
              orphans: {
                listProcesses: () =>
                  listProcesses({ cwd: hostEnvironmentValue.userData, timeoutMs: 10_000 }),
                killTree: (pid: number) => killPidTree(pid),
                onError: (stage: 'list' | 'kill', error: unknown, pid?: number) =>
                  rootLog.warn('shell.orphans.failed', { stage, pid, error: String(error) })
              }
            }
          : {}),
        onBootFailed: hooks.onBootFailed,
        onExited: () => {
          if (kind === 'data') dataReady = false
          hooks.onExited()
        },
        onReady: () => {
          if (kind === 'data') {
            dataReady = true
            updates.refreshGate()
          }
          hooks.onReady()
        }
      })
      supervisors[kind] = supervisor
      return supervisor
    }
  })
  hostBootRef = boot
  // 시스템이 깨어난 신호는 두 호스트에 알린다 — 원인마다 듣는 쪽이 다르다(EP-10).
  const wake = (reason: 'resume' | 'unlock-screen' | 'window-focus'): void => {
    supervisors.data?.send({ type: 'wake', reason })
    supervisors.agent?.send({ type: 'wake', reason })
  }
  powerMonitor.on('resume', () => wake('resume'))
  powerMonitor.on('unlock-screen', () => wake('unlock-screen'))
  app.on('browser-window-focus', () => wake('window-focus'))
  // 창 먼저(0109) — 본 화면은 두 호스트가 모두 준비된 뒤다(AC31′). renderer 부트의 첫 스텝이 이
  // 게이트를 기다린다.
  handlePlain(CHANNELS.bootWhenReady, () => boot.whenReady())
  boot.start()
  const mainWindow = createWindow(shellState)
  attachHostPorts(boot, mainWindow.webContents, rendererUrl)
  // 트레이 상주 (0322) — Windows 에서 창 닫기는 종료가 아니라 숨김이다. 창을 먼저 만든다:
  // 트레이 생성 실패는 프로그램 오류라 잡지 않는데, 그때 창 없는 프로세스가 남으면 안 된다.
  // 위치 저장 `close` 리스너(createWindow)가 숨김 판정보다 먼저 등록되는 순서도 여기서 정해진다.
  installTrayResidency({
    platform: process.platform,
    app,
    // 1254px 원본을 셸에 그대로 넘기지 않는다.
    createTray: () => new Tray(nativeImage.createFromPath(logo).resize({ width: 32, height: 32 })),
    buildMenu: (items) => Menu.buildFromTemplate(items),
    tooltip: PRODUCT_DISPLAY_NAME,
    open: focusMainWindow,
    settings: shellState
  }).attach(mainWindow)
  try {
    await boot.whenReady()
  } catch (err) {
    // 창은 이미 떠 있다 — 실패는 renderer 의 main-ready 필수 스텝(failed UX)으로 표면화된다.
    rootLog.error('app.start.failed', err)
    flushLogSync()
    return
  }
  rootLog.info('app.start.completed')
  void updates.check(true)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      attachHostPorts(boot, createWindow(shellState).webContents, rendererUrl)
    }
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

// 종료 — 에이전트 호스트(런타임 정지 → 저장 스트림 비움) → 데이터 호스트(예약 작업 → 스케줄러 →
// DB 닫기) 순서로 내린다(AC32′). 두 호스트가 끝날 때까지 종료를 미룬다.
registerNativeSettingsQuit(
  app,
  () => hostBootRef?.shutdown(),
  () => {
    rootLog.error('app.hosts.shutdown-failed')
  }
)

app.on('will-quit', () => {
  // app.quit.started 는 flush(closeLog) *이전* 에 emit 돼야 파일에 남는다(0123 AC9 정합).
  rootLog.info('app.quit.started')
  closeLog()
})
