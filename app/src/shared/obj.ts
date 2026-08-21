// 순수 객체 유틸 (L0 — 양 프로세스 안전, 런타임 의존 0).

// 값이 있을 때만 단일 키 객체를 만든다 — `...ifPresent('k', v)` 스프레드로 "정의된 필드만 포함"
// 패턴을 표현한다. semantics 는 `!= null`: null/undefined 만 드롭하고 0·'' 는 유지한다(DB nullable
// 컬럼·텔레메트리 누락 구분 보존). truthy 가드가 필요한 곳에는 쓰지 않는다.
export function ifPresent<K extends string, V>(
  key: K,
  value: V | null | undefined
): Record<K, V> | Record<string, never> {
  return value != null ? ({ [key]: value } as Record<K, V>) : {}
}

// 배열 아닌 plain object 가드 — JSON 파싱 결과를 좁힐 때 `!Array.isArray` 를 빼먹기 쉬워 SSOT 로 둔다.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// `undefined`/`null` 인 키를 지운다 — `ifPresent` 의 복수형이다. semantics 는 같다(`!= null`):
// 0·'' 는 유지한다.
//
// **인자 타입이 전 필드를 요구한다** (`Record<keyof T, unknown>` 이 존재를, `Partial<T>` 가 타입을
// 본다). 그래서 조립 대상 타입에 필드가 늘면 호출부 리터럴에서 컴파일이 깨진다 — "안 적어서
// 조용히 사라지는" 결함(0194 D1 `refreshToken`·D7 `principalId`)을 타입이 잡게 하는 것이 이
// 함수의 존재 이유다. `ifPresent` 누적은 그 자리를 만들지 못한다.
export function compact<T extends object>(source: Record<keyof T, unknown> & Partial<T>): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value != null) out[key] = value
  }
  return out as T
}
