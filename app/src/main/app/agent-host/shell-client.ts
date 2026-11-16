// 셸 서비스 클라이언트 (0324 EP-10 · AR-08). 에이전트 호스트의 Electron 권한 작업은 이 클라이언트로
// 셸에 부탁한다 — 호스트는 Electron API 를 부를 수 없다. 응답 전까지 호출한 코드는 기다린다.
// 셸이 보낸 `wake`(시스템이 깨어났다)도 여기서 구독한다. 이 파일은 Electron 을 모른다.

import type { HostToShell, ShellToHost } from '../../../shared/host-protocol'
import type {
  ShellServiceArgs,
  ShellServiceName,
  ShellServiceResults
} from '../../../shared/shell-services'

export interface ShellClient {
  call<N extends ShellServiceName>(
    name: N,
    ...args: ShellServiceArgs<N>
  ): Promise<ShellServiceResults[N]>
  // 셸이 보낸 메시지 중 이 클라이언트 몫(`service.result`·`wake`)이면 처리하고 true.
  receive(message: ShellToHost): boolean
  onWake(listener: () => void): () => void
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
  const wakeListeners = new Set<() => void>()

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
        for (const listener of [...wakeListeners]) listener()
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
    close(reason) {
      if (closedReason !== null) return
      closedReason = reason
      const waiting = [...pending.values()]
      pending.clear()
      for (const settle of waiting) settle.reject(new Error(reason))
    }
  }
}
