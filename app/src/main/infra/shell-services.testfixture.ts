// 테스트용 셸 서비스 포트 — 이름마다 넘긴 함수를 그대로 부른다. 넘기지 않은 이름을 부르면 던진다
// (테스트가 모르는 Electron 작업을 조용히 성공시키지 않는다).

import type { ShellServiceImpl, ShellServiceName, WakeReason } from '../../shared/shell-services'
import { setShellServices, type ShellServicesPort } from './shell-services'

export interface FakeShellServices extends ShellServicesPort {
  // 셸이 `wake` 를 보낸 것처럼 구독자에게 알린다.
  wake(reason: WakeReason): void
}

export function fakeShellServices(impl: Partial<ShellServiceImpl>): FakeShellServices {
  const wakeListeners = new Set<(reason: WakeReason) => void>()
  return {
    onWake: (listener: (reason: WakeReason) => void) => {
      wakeListeners.add(listener)
      return () => {
        wakeListeners.delete(listener)
      }
    },
    wake: (reason: WakeReason) => {
      for (const listener of [...wakeListeners]) listener(reason)
    },
    call: async (name: ShellServiceName, ...args: unknown[]) => {
      const method = impl[name] as ((...a: unknown[]) => unknown) | undefined
      if (!method) throw new Error(`테스트가 준비하지 않은 셸 서비스: ${name}`)
      return method(...args)
    }
  } as FakeShellServices
}

export function installFakeShellServices(impl: Partial<ShellServiceImpl>): FakeShellServices {
  const port = fakeShellServices(impl)
  setShellServices(port)
  return port
}
