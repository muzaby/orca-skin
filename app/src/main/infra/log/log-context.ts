// correlationId 전파 (0123 AC12) — main 비동기 흐름(한 턴 등)에 작업 단위 ID 를 실어,
// 명시 correlationId 없이 emit 된 로그도 같은 흐름으로 묶는다. 턴 단위 배선은 0124.
// electron 비의존 → vitest 대상.

import { AsyncLocalStorage } from 'node:async_hooks'

export interface LogContext {
  correlationId: string
}

const storage = new AsyncLocalStorage<LogContext>()

export function runWithLogContext<T>(context: LogContext, action: () => T): T {
  return storage.run(context, action)
}

export function currentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId
}
