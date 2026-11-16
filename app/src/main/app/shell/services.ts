// 셸 서비스 서버 (0324 EP-10 · AR-08). 에이전트 호스트의 `service.call` 을 받아 인자를 검증하고
// 셸 쪽 구현(Electron API)을 부른 뒤 `service.result` 로 답한다. 이 파일은 Electron 을 모른다 —
// 구현은 `electron-services.ts` 가 만들어 넘긴다.

import type { ShellToHost } from '../../../shared/host-protocol'
import { createShellClient, type ShellClient } from '../agent-host/shell-client'
import {
  SHELL_SERVICE_ARGS,
  isShellServiceName,
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
    try {
      const method = deps.impl[name] as (...args: readonly unknown[]) => unknown
      const value = await method(...(parsed.data as readonly unknown[]))
      deps.reply({ type: 'service.result', id: call.id, ok: true, value })
    } catch (error) {
      deps.onError?.(name, error)
      fail(errorText(error))
    }
  }
}

// 셸과 호스트가 한 프로세스인 동안의 포트 — 프로세스 경계와 같은 클라이언트·서버를 메모리에서
// 잇는다. 인자 검증과 오류 문장이 경계를 둔 뒤와 같다. 셸 → 호스트 통지(`wake`)는 반환한
// 클라이언트의 `receive` 로 넣는다.
export function connectShellServicesInProcess(
  impl: ShellServiceImpl,
  onError?: (name: string, error: unknown) => void
): ShellClient {
  const server = createShellServiceServer({
    impl,
    reply: (message) => {
      client.receive(message)
    },
    ...(onError ? { onError } : {})
  })
  const client = createShellClient({
    post: (message) => {
      if (message.type === 'service.call') void server(message)
    }
  })
  return client
}
