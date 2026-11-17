// 호스트 프로세스의 시작 순서 (0324 §7-F 4b·4c · AC18′ · AC46 · AC5′). 데이터 호스트와 에이전트 호스트의
// 진입점이 같은 순서를 쓴다:
//
// 1. fork 인자의 경로·버전 → 호스트 환경 (로그·DB·설정이 읽는다).
// 2. 프로세스별 로그 파일 · 이벤트 루프 멈춤 계측(`thread` = 호스트 이름).
// 3. 창 포트 전송을 IPC 전송으로 정한다 — 핸들러 등록보다 앞이다.
// 4. 셸 메시지 분배(`startHostRuntime`) · 셸 서비스 클라이언트.
// 5. 조립을 만들고(창 요청은 조립의 `serving` 까지 기다린다) 시작하고, 끝나면 셸에 `ready` 를 보낸다.
//    생성이나 시작이 던지면 프로세스를 끝낸다 — 셸의 감독자가 기동 실패로 센다.
//
// 이 파일은 Electron 을 모른다 — 진입점이 `process.parentPort` 를 넘긴다.

import type { HostToShell } from '../../shared/host-protocol'
import { reportError } from '../infra/error-report'
import { setHostEnvironment } from '../infra/host-environment'
import { setIpcTransport } from '../infra/ipc/transport'
import type { PeerPort } from '../infra/ipc/peer-link'
import { closeLog, flushLogSync, initLog, type LogHostProcess } from '../infra/log'
import { setStallThread, startLoopStallMonitor } from '../infra/perf/stall-monitor'
import { setShellServices } from '../infra/shell-services'
import { createPortTransport, type PortTransport } from './host-port-server'
import type { ShellClient } from './host-shell-client'
import { parseHostEnvironment, startHostRuntime, type ParentPort } from './host-runtime'

export type HostProcessName = Exclude<LogHostProcess, 'main'>

export interface HostProcessContext {
  readonly shell: ShellClient
  readonly transport: PortTransport
  toShell(message: HostToShell): void
}

// 진입점이 만드는 조립 하나.
export interface HostAssembly {
  // 끝나면 셸에 보낼 준비 메시지를 돌려준다(데이터 호스트는 UI 언어 사본을 싣는다).
  start(): Promise<Extract<HostToShell, { type: 'ready' }>>
  // 창 요청을 처리할 수 있게 되는 때. 그 전에 온 창 메시지는 도착 순서대로 기다린다. 없으면 바로 처리한다.
  serving?(): Promise<void>
  attachPeer(port: PeerPort): void
  peerUnavailable?(): void
  prepareInstall?(): void
  shutdown(): Promise<void> | void
}

export interface HostProcessDeps {
  name: HostProcessName
  parent: ParentPort
  argv: readonly string[]
  exit(code: number): void
  create(context: HostProcessContext): HostAssembly
  // 전역 예외 구독(진입점이 `process.on` 을 넘긴다). 테스트는 생략한다.
  onProcessError?(listener: (kind: 'rejection' | 'exception', error: unknown) => void): void
}

export function runHostProcess(deps: HostProcessDeps): HostAssembly {
  setHostEnvironment(parseHostEnvironment(deps.argv))
  const log = initLog(deps.name)
  setStallThread(deps.name)
  startLoopStallMonitor(deps.name)
  const transport = createPortTransport()
  setIpcTransport(transport)
  deps.onProcessError?.((kind, error) => {
    reportError({
      event: kind === 'rejection' ? 'app.unhandled.rejection' : 'app.uncaught.exception',
      scope: 'app',
      title: 'unexpected',
      level: 'error',
      error
    })
    flushLogSync()
  })

  let assembly: HostAssembly | null = null
  const runtime = startHostRuntime({
    parent: deps.parent,
    connectClient: (port, connection) => {
      transport.connect(port, connection)
    },
    attachPeer: (port) => assembly?.attachPeer(port),
    peerUnavailable: () => assembly?.peerUnavailable?.(),
    prepareInstall: () => assembly?.prepareInstall?.(),
    shutdown: async () => {
      try {
        await assembly?.shutdown()
      } finally {
        log.info('host.shutdown.completed', { host: deps.name })
        closeLog()
      }
    },
    exit: deps.exit,
    onInvalid: () => log.warn('host.shell-message.invalid', { host: deps.name })
  })
  setShellServices(runtime.shell)
  // 조립 생성이 던지면 시작이 던진 것과 같다 — 프로세스를 끝내 셸의 감독자가 기동 실패로 센다. 그냥 두면
  // 전역 예외 처리기가 삼켜 준비를 알리지 않은 채 멈춘다.
  let created: HostAssembly
  try {
    created = deps.create({ shell: runtime.shell, transport, toShell: runtime.toShell })
  } catch (error) {
    log.error('host.start.failed', error, { host: deps.name, stage: 'create' })
    flushLogSync()
    deps.exit(1)
    throw error
  }
  assembly = created
  const serving = created.serving?.()
  if (serving) transport.hold(serving)
  created.start().then(
    (ready) => {
      log.info('host.start.completed', { host: deps.name })
      runtime.toShell(ready)
    },
    (error: unknown) => {
      log.error('host.start.failed', error, { host: deps.name })
      flushLogSync()
      deps.exit(1)
    }
  )
  return created
}
