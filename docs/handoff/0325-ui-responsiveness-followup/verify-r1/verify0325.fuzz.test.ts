// 0325 verify 1회째 독립 축(⑥) — 구현 보고·등록 목록에 없는 비교. 검증 뒤 삭제한다.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { createExchangeGrouper, exchangeEquals, type Exchange } from '../../../lib/turns'
import { groupExchanges as groupV0 } from './turnsV0.verify'
import { projectTimeline } from './projection'
import { projectTimeline as projectV0 } from './projectionV0.verify'
import {
  estimateWireChars,
  nextSessionChunkEnd,
  splitSessionMessages
} from '../../../../../../../shared/data-host'
import { tokenizeComposerDecoration } from '../../common/composer/composerDecoration'
import { tokenizeComposerDecoration as tokV0 } from './composerDecorationV0.verify'

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const int = (r: () => number, n: number): number => Math.floor(r() * n)

let serial = 0
const makers: Array<() => Message> = [
  () => ({ role: 'user', createdAt: ++serial, parts: [{ type: 'text', text: `q${serial}` }] }),
  () => ({
    role: 'user',
    createdAt: ++serial,
    parts: [{ type: 'text', text: 'auto', origin: { kind: 'automatic' } }]
  }),
  () => ({
    role: 'user',
    createdAt: ++serial,
    parts: [
      { type: 'text', text: `m${serial}` },
      { type: 'text', text: 'auto', origin: { kind: 'automatic' } }
    ]
  }),
  () => ({ role: 'assistant', createdAt: ++serial, parts: [{ type: 'text', text: `a${serial}` }] })
] as Array<() => Message>

describe('X1 grouper 다단계 무작위 편집 ≡ 변경 전 groupExchanges · 동치 exchange 참조 유지', () => {
  it.each(Array.from({ length: 400 }, (_, i) => i))('seed %i', (seed) => {
    const r = rng(seed + 1)
    const grouper = createExchangeGrouper()
    let messages: Message[] = []
    let show = false
    let previous: Exchange[] | undefined
    let previousShow = show
    for (let step = 0; step < 40; step++) {
      const op = int(r, 9)
      const next = [...messages]
      if (op === 0 || next.length === 0) next.push(pick(r, makers)())
      else if (op === 1) next.splice(int(r, next.length + 1), 0, pick(r, makers)())
      else if (op === 2) next[int(r, next.length)] = pick(r, makers)()
      else if (op === 3) {
        const i = int(r, next.length)
        next[i] = { ...next[i] }
      } else if (op === 4) next.splice(int(r, next.length), 1)
      else if (op === 5) next.length = int(r, next.length + 1)
      else if (op === 6) show = !show
      else if (op === 7) next.push(pick(r, makers)(), pick(r, makers)())
      messages = op === 8 ? messages : next
      const result = grouper(messages, { showAutomaticFeeds: show })
      expect(result).toEqual(groupV0(messages, { showAutomaticFeeds: show }))
      if (previous && show === previousShow)
        for (const exchange of result) {
          const before = previous.find((p) => p.startIndex === exchange.startIndex)
          if (before && exchangeEquals(before, exchange)) expect(exchange).toBe(before)
        }
      previous = result
      previousShow = show
    }
  })
})

describe('X2 presence 투영 ≡ 변경 전 문자열 투영(무작위 메시지·live·옵션)', () => {
  const golden = JSON.parse(
    readFileSync(new URL('./projection.golden.json', import.meta.url), 'utf8')
  ) as Array<{ messages: Message[] }>
  const pool = golden.flatMap((c) => c.messages.flatMap((m) => m.parts))
  const synthetic = [
    { type: 'text', text: '' },
    { type: 'text', text: ' ' },
    { type: 'text', text: 'hello' },
    { type: 'reasoning', text: '' },
    { type: 'reasoning', text: '   ' },
    { type: 'reasoning', text: 'why' }
  ]
  const parts = [...pool, ...synthetic, ...synthetic]
  it.each(Array.from({ length: 300 }, (_, i) => i))('seed %i', (seed) => {
    const r = rng(seed + 1000)
    const messages: Message[] = []
    const count = int(r, 7)
    for (let i = 0; i < count; i++) {
      if (r() < 0.35) messages.push(pick(r, makers.slice(0, 3))())
      else
        messages.push({
          role: 'assistant',
          createdAt: ++serial,
          parts: Array.from({ length: int(r, 5) }, () => structuredClone(pick(r, parts)))
        } as Message)
    }
    for (const text of ['', ' ', 'ab'])
      for (const reasoning of ['', '  ', 'r', ' r '])
        for (const pending of [false, true])
          for (const showAutomaticFeeds of [false, true]) {
            const live = { text, reasoning, pending }
            expect(projectTimeline(messages, live, { showAutomaticFeeds })).toEqual(
              projectV0(messages, live, { showAutomaticFeeds })
            )
          }
  })
})

describe('X3 조각 분할 — 무작위 작은 예산에서 보존·비어 있지 않음·상한·최대성', () => {
  it.each(Array.from({ length: 300 }, (_, i) => i))('seed %i', (seed) => {
    const r = rng(seed + 5000)
    const limits = { messages: 1 + int(r, 5), parts: 1 + int(r, 8), chars: 10 + int(r, 300) }
    const messages = Array.from({ length: int(r, 30) }, () => ({
      role: r() < 0.5 ? 'user' : 'assistant',
      createdAt: ++serial,
      parts: Array.from({ length: int(r, 5) }, () => ({ type: 'text', text: 'x'.repeat(int(r, 60)) }))
    })) as never[]
    const chunks = splitSessionMessages(messages, limits)
    expect(chunks.flat()).toEqual(messages)
    chunks.flat().forEach((m, i) => expect(m).toBe(messages[i]))
    let start = 0
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0)
      const parts = chunk.reduce((n, m: { parts: unknown[] }) => n + m.parts.length, 0)
      const chars = chunk.reduce((n, m) => n + estimateWireChars(m), 0)
      if (chunk.length > 1) {
        expect(chunk.length).toBeLessThanOrEqual(limits.messages)
        expect(parts).toBeLessThanOrEqual(limits.parts)
        expect(chars).toBeLessThanOrEqual(limits.chars)
      }
      const end = start + chunk.length
      expect(nextSessionChunkEnd(messages, start, limits)).toBe(end)
      if (end < messages.length) {
        const nextMessage = messages[end] as { parts: unknown[] }
        const fits =
          chunk.length + 1 <= limits.messages &&
          parts + nextMessage.parts.length <= limits.parts &&
          chars + estimateWireChars(nextMessage) <= limits.chars
        expect(fits).toBe(false)
      }
      start = end
    }
  })

  it('estimateWireChars(v, limit) — 합이 limit 이하면 전체 값과 같고, 넘으면 limit 초과 값', () => {
    const r = rng(77)
    const gen = (depth: number): unknown => {
      const k = int(r, depth > 3 ? 3 : 6)
      if (k === 0) return 'y'.repeat(int(r, 20))
      if (k === 1) return int(r, 100)
      if (k === 2) return null
      if (k === 3) return Array.from({ length: int(r, 4) }, () => gen(depth + 1))
      return Object.fromEntries(
        Array.from({ length: int(r, 4) }, (_, i) => [`k${i}${'z'.repeat(int(r, 5))}`, gen(depth + 1)])
      )
    }
    for (let i = 0; i < 2000; i++) {
      const value = gen(0)
      const full = estimateWireChars(value)
      const limit = int(r, full + 10)
      const bounded = estimateWireChars(value, limit)
      if (full <= limit) expect(bounded).toBe(full)
      else expect(bounded).toBeGreaterThan(limit)
    }
  })
})

describe('X4 스킬 장식 ≡ 변경 전 토큰화(구두점·이모지 알파벳 무작위)', () => {
  it.each(Array.from({ length: 300 }, (_, i) => i))('seed %i', (seed) => {
    const r = rng(seed + 9000)
    const alphabet = ['a', 'b', '.', ')', '!', ',', '🚀', '}', '-']
    const word = (max: number): string =>
      Array.from({ length: int(r, max) }, () => pick(r, alphabet)).join('')
    const names = new Set(Array.from({ length: int(r, 7) }, () => word(5)))
    const files = new Set(['a.ts', 'b.md'])
    const value = Array.from({ length: 1 + int(r, 6) }, () =>
      pick(r, [() => `/${word(7)}`, () => `@${pick(r, ['a.ts', 'b.md', 'c'])}`, () => word(4)])()
    ).join(pick(r, [' ', '\n', '  ']))
    expect(tokenizeComposerDecoration(value, names, files)).toEqual(tokV0(value, names, files))
  })
})
