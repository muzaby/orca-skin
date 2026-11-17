// 셸 서비스 서버 (0324 EP-10 · AR-08). 에이전트 호스트의 `service.call` 을 받아 인자를 검증하고
// 셸 쪽 구현(Electron API)을 부른 뒤 `service.result` 로 답한다. 이 파일은 Electron 을 모른다 —
// 구현은 `electron-services.ts` 가 만들어 넘긴다.

import type { ShellToHost } from '../../../shared/host-protocol'
import {
  SHELL_SERVICE_ARGS,
  isShellServiceName,
  type ShellServiceContext,
  type ShellServiceImpl
} from '../../../shared/shell-services'

export interface ServiceCall {
  readonly id: number
  readonly name: string
  readonly args: readonly unknown[]
}

export interface ShellServiceServerDeps {
  impl: ShellServiceImpl
  reply(message: ShellToHost): void
  // 구현이 던진 오류 — 응답과 별개로 셸 로그에 남긴다.
  onError?(name: string, error: unknown): void
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

// 요청 하나를 처리한다. 어떤 경우에도 응답을 정확히 한 번 보낸다 — 답이 없으면 호스트의 호출이
// 영원히 기다린다.
export function createShellServiceServer(
  deps: ShellServiceServerDeps
): (call: ServiceCall) => Promise<void> {
  return async (call) => {
    const fail = (error: string): void =>
      deps.reply({ type: 'service.result', id: call.id, ok: false, error })
    if (!isShellServiceName(call.name)) {
      fail(`모르는 셸 서비스: ${call.name}`)
      return
    }
    const name = call.name
    const parsed = SHELL_SERVICE_ARGS[name].safeParse(call.args)
    if (!parsed.success) {
      fail(`셸 서비스 인자가 틀렸다: ${name}`)
      return
    }
    // 셸 → 호스트 통지는 요청을 보낸 호스트에게만 간다(그 호스트의 `reply` 다).
    const context: ShellServiceContext = {
      notifyLoginNavigated: (loginId, seq, url) =>
        deps.reply({ type: 'login.navigated', loginId, seq, url })
    }
    try {
      const method = deps.impl[name] as (...args: readonly unknown[]) => unknown
      const value = await method(...(parsed.data as readonly unknown[]), context)
      deps.reply({ type: 'service.result', id: call.id, ok: true, value })
    } catch (error) {
      deps.onError?.(name, error)
      fail(errorText(error))
    }
  }
}
