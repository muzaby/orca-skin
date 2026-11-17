// 호스트 프로세스의 공용 런타임 (0324 §7-F 4b·4c — 데이터 호스트와 에이전트 호스트의 진입점이 함께 쓴다).
//
// 셸(부모)이 보낸 메시지를 스키마로 검증해 각자의 수신처로 넘긴다:
// - `client.connect`(포트 동봉) → 창 포트 전송에 그 창을 연결한다.
// - `peer.connect`(포트 동봉) → 피어 링크에 새 포트를 붙인다. `peer.unavailable` → 줄 선 요청을 실패시킨다.
// - `service.result`·`wake` → 셸 서비스 클라이언트.
// - `update.prepare-install` → 쉬는 런타임을 닫는다(에이전트 호스트).
// - `shutdown` → 정리한 뒤 스스로 끝난다. 정리가 던져도 끝난다 — 셸은 제한 시간 뒤 강제로 끝낸다.
//
// 이 파일은 Electron 을 모른다 — 진입점이 `process.parentPort` 와 `MessagePortMain` 을 감싸 넘긴다.

import { ShellToHostSchema, type HostToShell } from '../../shared/host-protocol'
import type { HostEnvironment } from '../infra/host-environment'
import type { PeerPort } from '../infra/ipc/peer-link'
import { createShellClient, type ShellClient } from './host-shell-client'
import type { ClientConnection, HostPort } from './host-port-server'

// `MessagePortMain` 의 쓰는 부분.
export interface RawPort {
  postMessage(message: unknown): void
  on(event: 'message', listener: (event: { data: unknown }) => void): unknown
  on(event: 'close', listener: () => void): unknown
  start(): void
  close(): void
}

// `process.parentPort` 의 쓰는 부분.
export interface ParentPort {
  postMessage(message: unknown): void
  on(event: 'message', listener: (event: { data: unknown; ports: RawPort[] }) => void): unknown
}

// 창 포트·피어 포트가 같은 모양을 쓴다.
export function wrapPort(port: RawPort): HostPort & PeerPort {
  return {
    post: (message: unknown) => port.postMessage(message),
    onMessage: (listener) => {
      port.on('message', (event) => listener(event.data))
    },
    onClose: (listener) => {
      port.on('close', listener)
    },
    start: () => port.start(),
    close: () => port.close()
  }
}

export interface HostRuntimeDeps {
  parent: ParentPort
  connectClient(port: HostPort, connection: ClientConnection): void
  attachPeer(port: PeerPort): void
  peerUnavailable?(): void
  prepareInstall?(): void
  // 정리 — 끝나면(던져도) 프로세스를 끝낸다.
  shutdown(): Promise<void> | void
  exit(code: number): void
  onInvalid?(): void
}

export interface HostRuntime {
  readonly shell: ShellClient
  toShell(message: HostToShell): void
}

export function startHostRuntime(deps: HostRuntimeDeps): HostRuntime {
  const toShell = (message: HostToShell): void => deps.parent.postMessage(message)
  const shell = createShellClient({ post: toShell })
  let stopping = false

  deps.parent.on('message', (event) => {
    const parsed = ShellToHostSchema.safeParse(event.data)
    if (!parsed.success) {
      deps.onInvalid?.()
      for (const port of event.ports) port.close()
      return
    }
    const message = parsed.data
    if (shell.receive(message)) return
    switch (message.type) {
      case 'client.connect': {
        const port = event.ports[0]
        if (!port) return deps.onInvalid?.()
        deps.connectClient(wrapPort(port), {
          clientId: message.clientId,
          trusted: message.trusted
        })
        return
      }
      case 'peer.connect': {
        const port = event.ports[0]
        if (!port) return deps.onInvalid?.()
        deps.attachPeer(wrapPort(port))
        return
      }
      case 'peer.unavailable':
        deps.peerUnavailable?.()
        return
      case 'update.prepare-install':
        deps.prepareInstall?.()
        return
      case 'shutdown': {
        if (stopping) return
        stopping = true
        void (async () => {
          try {
            await deps.shutdown()
          } finally {
            shell.close('호스트가 종료 중이다')
            deps.exit(0)
          }
        })().catch(() => deps.exit(1))
        return
      }
    }
  })

  return { shell, toShell }
}

// fork 인자 — 셸이 Electron 에서 읽은 경로·버전을 한 인자로 넘긴다(§11 단계 4).
export const HOST_ENVIRONMENT_ARG = '--oo-host-environment='

export function hostEnvironmentArg(environment: HostEnvironment): string {
  return `${HOST_ENVIRONMENT_ARG}${JSON.stringify(environment)}`
}

export function parseHostEnvironment(argv: readonly string[]): HostEnvironment {
  const raw = argv.find((arg) => arg.startsWith(HOST_ENVIRONMENT_ARG))
  if (!raw) throw new Error('호스트 환경 인자가 없다')
  const value: unknown = JSON.parse(raw.slice(HOST_ENVIRONMENT_ARG.length))
  const record = value as Record<string, unknown> | null
  const text = (key: string): string => {
    const field = record?.[key]
    if (typeof field !== 'string' || field === '')
      throw new Error(`호스트 환경 인자가 틀렸다: ${key}`)
    return field
  }
  if (typeof record?.isPackaged !== 'boolean')
    throw new Error('호스트 환경 인자가 틀렸다: isPackaged')
  return {
    userData: text('userData'),
    desktop: text('desktop'),
    appVersion: text('appVersion'),
    isPackaged: record.isPackaged,
    appPath: text('appPath')
  }
}
