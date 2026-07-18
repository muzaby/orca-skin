// 루트 로거 레지스트리 (0124) — electron 비의존 접근자. infra/log/index.ts(electron 값 주입)가
// initLog/closeLog 에서 setRootLogger 로 채우고 비운다. 순수 vitest 대상 모듈(features·infra·
// adapters)은 barrel(index.ts, electron import) 대신 이 모듈에서 getLogger 를 import 한다 —
// 미초기화 시 no-op 폴백(로거 장애 ≠ 앱 장애). 항상 호출 시점에 getLogger() 를 부른다
// (모듈 스코프 캡처 금지 — initLog 이전 import 는 no-op 을 고정한다).

import type { AppLogger } from './log-manager'

const NOOP_LOGGER: AppLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => NOOP_LOGGER
}

let rootLogger: AppLogger | null = null

export function setRootLogger(logger: AppLogger | null): void {
  rootLogger = logger
}

export function getLogger(): AppLogger {
  return rootLogger ?? NOOP_LOGGER
}
