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

// `unknown` 을 원시 타입으로 좁히고, 아니면 `undefined`. JSON 파서가 필드마다 쓰는 삼항을
// 이름으로 만든 것이다 — `compact` 의 인자에 그대로 넘길 수 있어 "없으면 키를 지운다" 가
// 한 줄로 표현된다.
export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

// `T` 의 키를 **선택적인 것과 아닌 것**으로 가른다. `undefined extends T[K]` 가 판정이고, 이는
// `exactOptionalPropertyTypes` 가 꺼져 있어 `k?: V` 의 타입이 `V | undefined` 이기에 성립한다.
//
// 선택 키는 **필수 키의 여집합으로 유도한다** — 같은 술어를 `never`/`K` 만 바꿔 두 번 적으면
// 한쪽만 고쳐질 수 있고, 여집합으로 두면 "둘이 `keyof T` 를 분할한다" 가 구문으로 참이 된다.
type RequiredKeysOf<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T]
type OptionalKeysOf<T> = Exclude<keyof T, RequiredKeysOf<T>>

// `compact` 의 인자 타입 — **전 필드를 요구하되, `undefined` 는 선택 키에만 허용한다.**
//
// 두 매핑 타입 모두 키 union 위에 얹혀(=homomorphic 이 아니라) `?` 를 승계하지 않는다. 그래서
// **모든 키가 존재해야** 하고, 안 적은 필드는 호출부 리터럴에서 컴파일이 깨진다. 값 타입은
// 갈래로 나뉜다 — 선택 키만 `null` 까지 받고, **필수 키는 `T[K]` 그대로**다.
//
// 이 두 번째 갈래가 0194 D14 다. 옛 판은 `Record<keyof T, unknown> & Partial<T>` 였는데
// `Partial<T>` 가 **필수 키에도 `undefined` 를 허용**해 `vaultKey: undefined` 가 typecheck 를
// 통과했고, 아래 `as T` 가 그것을 감춰 런타임에만 드러났다.
//
// **`-?` 로는 못 쓴다** — homomorphic 매핑에서 `-?` 는 `?` 뿐 아니라 값 타입의 `undefined` 까지
// 벗겨서, 선택 키에 `undefined` 를 넘기는 정상 호출이 전부 깨진다(r4 실측 8건).
// `T extends unknown` 은 **union 을 분배시키기 위한** 조건절이다. 없으면 `keyof (A | B)` 가 공통
// 키만 내어, `compact<Grant>` 같은 호출이 `vaultKey` 를 요구하지 않고 통과한다 — 전수 강제가
// 갈래 수만큼 조용히 느슨해지는 자리다(r4 실측).
export type CompactSource<T extends object> = T extends unknown
  ? { [K in RequiredKeysOf<T>]: T[K] } & { [K in OptionalKeysOf<T>]: T[K] | null }
  : never

// `undefined`/`null` 인 키를 지운다 — `ifPresent` 의 복수형이다. semantics 는 같다(`!= null`):
// 0·'' 는 유지한다.
//
// 조립 대상 타입에 필드가 늘면 호출부 리터럴에서 컴파일이 깨진다 — "안 적어서 조용히
// 사라지는" 결함(0194 D1 `refreshToken`·D7 `principalId`)을 타입이 잡게 하는 것이 이 함수의
// 존재 이유다. `ifPresent` 누적은 그 자리를 만들지 못한다.
export function compact<T extends object>(source: CompactSource<T>): T {
  const out: Record<string, unknown> = {}
  // 인자는 매핑 타입이라 index signature 가 없다 — 순회를 위해서만 좁힌다.
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (value != null) out[key] = value
  }
  return out as T
}
