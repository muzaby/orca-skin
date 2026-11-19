// verify 0325 2회째 독립 축(⑥) X6·X7 — 실행 중에만 app/src/shared/ 에 복사한다.
import { describe, expect, it } from 'vitest'
import { estimateWireChars, nextSessionChunkEnd } from './data-host'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function gen(r: () => number, depth: number): unknown {
  const k = r()
  if (depth <= 0 || k < 0.35) return 'x'.repeat(Math.floor(r() * 8))
  if (k < 0.45) return null
  if (k < 0.5) return Math.floor(r() * 100)
  const n = Math.floor(r() * 4)
  if (k < 0.75) return Array.from({ length: n }, () => gen(r, depth - 1))
  const o: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) o['k'.repeat(1 + Math.floor(r() * 3)) + i] = gen(r, depth - 1)
  return o
}

// 읽기 계수 Proxy — 자식 값 읽기(get)만 센다. 배열 length·심볼은 제외.
function counted(value: unknown, log: { reads: number }): unknown {
  if (value === null || typeof value !== 'object') return value
  const wrappedKids = new Map<PropertyKey, unknown>()
  return new Proxy(value as object, {
    get(target, prop, recv) {
      if (typeof prop === 'symbol' || (Array.isArray(target) && prop === 'length')) return Reflect.get(target, prop, recv)
      log.reads++
      if (!wrappedKids.has(prop)) wrappedKids.set(prop, counted(Reflect.get(target, prop, recv), log))
      return wrappedKids.get(prop)
    }
  })
}

// 참조 모델 — 전위 순회, 노드마다 +2, 문자열 길이, 객체 키 길이(자식 읽기 전), 노드 방문 뒤에만 초과 판정.
function reference(value: unknown, limit: number): { total: number; reads: number } {
  let total = 0
  let reads = 0
  const visit = (node: unknown): boolean => {
    total += 2
    if (typeof node === 'string') total += node.length
    if (total > limit) return true
    if (node !== null && typeof node === 'object') {
      if (Array.isArray(node)) {
        for (const child of node) {
          reads++
          if (visit(child)) return true
        }
      } else {
        for (const key of Object.keys(node)) {
          total += key.length
          reads++
          if (visit((node as Record<string, unknown>)[key])) return true
        }
      }
    }
    return false
  }
  visit(value)
  return { total, reads }
}

describe('verify0325r2 X6 — estimateWireChars ≡ 참조 모델(합·읽기 수)', () => {
  it('600 seed × 예산 0..full+1 표본', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const r = rng(seed)
      const value = gen(r, 4)
      const full = reference(value, Number.POSITIVE_INFINITY).total
      const limits = [0, 1, 2, Math.floor(full / 2), full - 1, full, full + 1, Math.floor(r() * (full + 2))]
      for (const limit of limits) {
        const log = { reads: 0 }
        const got = estimateWireChars(counted(value, log), limit)
        const ref = reference(value, limit)
        expect([seed, limit, got, log.reads]).toEqual([seed, limit, ref.total, ref.reads])
      }
    }
  })
})

describe('verify0325r2 X7 — nextSessionChunkEnd 는 후보 뒤 메시지를 읽지 않고 후보를 남은 예산까지만 잰다', () => {
  it('400 seed', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = rng(seed * 7919)
      const count = 1 + Math.floor(r() * 12)
      const raw = Array.from({ length: count }, (_, i) => ({
        info: { id: `m${i}` },
        parts: Array.from({ length: Math.floor(r() * 4) }, () => ({ text: 'p'.repeat(Math.floor(r() * 30)) }))
      }))
      const limits = {
        messages: 1 + Math.floor(r() * 6),
        parts: 1 + Math.floor(r() * 8),
        chars: Math.floor(r() * 300)
      }
      const logs = raw.map(() => ({ reads: 0 }))
      const accessed = new Set<number>()
      const messages = new Proxy(
        raw.map((m, i) => counted(m, logs[i])),
        {
          get(target, prop, recv) {
            if (typeof prop === 'string' && /^\d+$/.test(prop)) accessed.add(Number(prop))
            return Reflect.get(target, prop, recv)
          }
        }
      ) as never
      const end = nextSessionChunkEnd(messages, 0, limits)
      expect(end).toBeGreaterThanOrEqual(1)
      // 읽는 메시지는 조각 [0,end) 과 후보 end 하나뿐
      for (const i of accessed) expect([seed, i <= end]).toEqual([seed, true])
      // 조각 안 메시지의 문자 합은 예산 이하(단독 첫 메시지는 예외)
      const sum = raw.slice(0, end).reduce((a, m) => a + reference(m, Number.POSITIVE_INFINITY).total, 0)
      if (end > 1) expect([seed, sum <= limits.chars]).toEqual([seed, true])
      // 후보가 문자 경계로 끊겼다면, 후보 읽기 수는 남은 예산 참조 모델과 같다
      const solo = end === 1 && reference(raw[0], Number.POSITIVE_INFINITY).total > limits.chars
      if (!solo && end < count && end - 0 < limits.messages) {
        const partsSoFar = raw.slice(0, end).reduce((a, m) => a + m.parts.length, 0)
        const candidate = raw[end]
        if (!(partsSoFar + candidate.parts.length > limits.parts)) {
          const remaining = limits.chars - sum
          const ref = reference(candidate, remaining)
          // +1 = nextSessionChunkEnd 의 message.parts 읽기
          expect([seed, logs[end].reads]).toEqual([seed, 1 + ref.reads])
        }
      }
    }
  })
})
