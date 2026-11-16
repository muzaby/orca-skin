// preload 가 없는 환경(테스트·프리뷰)에서도 안전한 `window.oo` 접근 (0324 D-028).
// 부팅 전·부분 스텁에서도 불리는 로깅·오류 보고·선택적 구독만 여기 둔다 — 그 밖의 호출은
// `./ipc.ts` 의 typed API 를 쓴다. `window.oo` 를 직접 읽는 자리는 `shared/api/` 뿐이다
// (가드 `check-ui-thread` 규칙 (h)).

import type { BackgroundEvent } from '../../../../shared/background-task'

type Oo = Window['oo']

function oo(): Oo | undefined {
  return typeof window === 'undefined' ? undefined : window.oo
}

export function logBridge(): Oo['log'] | undefined {
  return oo()?.log
}

export function errorBridge(): Oo['error'] | undefined {
  return oo()?.error
}

type NativeResourcesHandler = Parameters<Oo['session']['onNativeResourcesChanged']>[0]

// 구독 API 가 없으면 아무것도 하지 않는다.
export function onNativeResourcesChangedIfAvailable(handler: NativeResourcesHandler): void {
  oo()?.session?.onNativeResourcesChanged?.(handler)
}

export function onBackgroundEventIfAvailable(handler: (event: BackgroundEvent) => void): void {
  oo()?.chat?.onBackgroundEvent?.(handler)
}
