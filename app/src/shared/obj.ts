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
