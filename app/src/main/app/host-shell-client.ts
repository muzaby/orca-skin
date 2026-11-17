// 셸 서비스 클라이언트 (0324 EP-10 · AR-08). 두 호스트의 Electron 권한 작업은 이 클라이언트로
// 셸에 부탁한다 — 호스트는 Electron API 를 부를 수 없다. 응답 전까지 호출한 코드는 기다린다.
// 셸이 보낸 `wake`(시스템이 깨어났다)도 여기서 구독한다. 이 파일은 Electron 을 모른다.

import type { HostToShell, ShellToHost } from '../../shared/host-protocol'
import type { ShellServicesPort } from '../infra/shell-services'
import type {
  ShellServiceArgs,
  ShellServiceName,
  ShellServiceResults,
  WakeReason
} from '../../shared/shell-services'

export interface ShellClient extends ShellServicesPort {
  call<N extends ShellServiceName>(
    name: N,
    ...args: ShellServiceArgs<N>
  ): Promise<ShellServiceResults[N]>
  // 셸의 로그인 창이 이동했다(파티션 세션) — 판정은 `session.loginVerdict` 로 답한다.
  onLoginNavigated(listener: (loginId: string, seq: number, url: string) => void): () => void
  // 셸이 보낸 메시지 중 이 클라이언트 몫(`service.result`·`wake`·`login.navigated`)이면 처리하고 true.
  receive(message: ShellToHost): boolean
  // 셸과의 연결이 끊겼다 — 기다리는 호출을 모두 실패시키고 이후 호출은 바로 실패한다.
  close(reason: string): void
}

interface Pending {
  resolve(value: unknown): void
  reject(error: Error): void
}

export function createShellClient(deps: { post(message: HostToShell): void }): ShellClient {
  let nextId = 0
  let closedReason: string | null = null
  const pending = new Map<number, Pending>()
  const wakeListeners = new Set<(reason: WakeReason) => void>()
  const navigationListeners = new Set<(loginId: string, seq: number, url: string) => void>()

  return {
    call(name, ...args) {
      if (closedReason !== null) return Promise.reject(new Error(closedReason))
      const id = nextId++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
        deps.post({ type: 'service.call', id, name, args: [...args] })
      })
    },
    receive(message) {
      if (message.type === 'wake') {
        for (const listener of [...wakeListeners]) listener(message.reason)
        return true
      }
      if (message.type === 'login.navigated') {
        for (const listener of [...navigationListeners])
          listener(message.loginId, message.seq, message.url)
        return true
      }
      if (message.type !== 'service.result') return false
      const settle = pending.get(message.id)
      if (!settle) return true
      pending.delete(message.id)
      if (message.ok) settle.resolve(message.value)
      else settle.reject(new Error(message.error ?? '셸 서비스 실패'))
      return true
    },
    onWake(listener) {
      wakeListeners.add(listener)
      return () => {
        wakeListeners.delete(listener)
      }
    },
    onLoginNavigated(listener) {
      navigationListeners.add(listener)
      return () => {
        navigationListeners.delete(listener)
      }
    },
    close(reason) {
      if (closedReason !== null) return
      closedReason = reason
      const waiting = [...pending.values()]
      pending.clear()
      for (const settle of waiting) settle.reject(new Error(reason))
    }
  }
}
