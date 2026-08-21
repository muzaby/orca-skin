import { describe, expect, it } from 'vitest'
import { compact, ifPresent, isRecord } from './obj'

// 0194 D15 — `compact`·`ifPresent` 의 `!= null` semantics 에 눈이 없었다. "0·'' 는 유지한다" 가
// 주석의 계약으로만 있었고, `!value` 로 바꿔도 저장소 전체가 green 이었다.

describe('compact', () => {
  it('undefined 와 null 인 키를 지운다', () => {
    const out = compact<{ a: string; b?: string; c?: number }>({
      a: 'keep',
      b: undefined,
      c: null
    })

    expect(out).toEqual({ a: 'keep' })
    expect(Object.keys(out)).toEqual(['a'])
  })

  it('0 · 빈 문자열 · false 는 유지한다 — 판정은 truthy 가 아니라 `!= null` 이다', () => {
    const out = compact<{ zero: number; empty: string; flag: boolean }>({
      zero: 0,
      empty: '',
      flag: false
    })

    expect(out).toEqual({ zero: 0, empty: '', flag: false })
  })

  it('빈 입력은 빈 객체다', () => {
    expect(compact<{ a?: string }>({ a: undefined })).toEqual({})
  })
})

// ── `CompactSource` 의 음성 타입 테스트 (0194 D14) ──────────────────────────
//
// 타입이 좁아졌다는 구조적 사실만으로는 결함이 막혔다고 말할 수 없다. `@ts-expect-error` 는
// **뒤집힌 단언**이라 그 줄의 오류가 사라지면 `typecheck:test` 가 깨진다 — 한 번 심었다 지우는
// 변이와 달리 다음 라운드에도 남는 눈이다(같은 수단의 선례: `deployment-wiring.test.ts`).
interface Sample {
  required: string
  optional?: number
}

// `Sample` 과 필수 키가 다른 갈래. union 호출에서 고유 키가 요구되는지 보는 데만 쓴다.
interface Wide {
  required: string
  only: string
}

describe('compact — 타입이 잡는 것', () => {
  it('필수 키에 undefined 를 넣으면 컴파일이 깨진다', () => {
    // @ts-expect-error 필수 키는 `undefined` 를 받지 않는다 — r3 판(`Partial<T>`)은 통과시켰다.
    expect(compact<Sample>({ required: undefined, optional: 1 })).toEqual({ optional: 1 })
  })

  it('키를 빼면 컴파일이 깨진다 — 안 적어서 조용히 사라지는 필드를 여기서 잡는다', () => {
    // @ts-expect-error `optional` 키가 빠졌다.
    expect(compact<Sample>({ required: 'v' })).toEqual({ required: 'v' })
  })

  it('선택 키의 undefined·null 은 정상이다 — 위 두 규칙이 실사용까지 막으면 안 된다', () => {
    expect(compact<Sample>({ required: 'v', optional: undefined })).toEqual({ required: 'v' })
    expect(compact<Sample>({ required: 'v', optional: null })).toEqual({ required: 'v' })
  })

  it('union 으로 불러도 갈래의 고유 키를 요구한다 — 공통 키만 요구하면 강제가 갈래 수만큼 샌다', () => {
    // @ts-expect-error 어느 갈래도 채우지 못했다 — 분배 없이는 `keyof (A | B)` 가 공통 키만 준다.
    expect(compact<Sample | Wide>({ required: 'v' })).toEqual({ required: 'v' })
  })
})

describe('ifPresent', () => {
  it('값이 있으면 단일 키 객체, 없으면 빈 객체다', () => {
    expect(ifPresent('k', 'v')).toEqual({ k: 'v' })
    expect(ifPresent('k', undefined)).toEqual({})
    expect(ifPresent('k', null)).toEqual({})
  })

  it('0 · 빈 문자열 · false 는 유지한다 — `compact` 와 같은 semantics 다', () => {
    expect(ifPresent('k', 0)).toEqual({ k: 0 })
    expect(ifPresent('k', '')).toEqual({ k: '' })
    expect(ifPresent('k', false)).toEqual({ k: false })
  })
})

describe('isRecord', () => {
  it('plain object 만 참이다 — 배열과 null 은 거짓이다', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('s')).toBe(false)
    expect(isRecord(undefined)).toBe(false)
  })
})
