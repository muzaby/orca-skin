// 0244 — `settings:get` 조기 등록의 **순서** 잠금.
//
// 창은 `start()` 완료 전에 열리고(0109) `TweakProvider` 는 부팅 게이트 밖에서 마운트 즉시
// 설정을 읽는다. 읽기 등록이 `start()` 의 첫 `await` 뒤로 밀리면 그 읽기가
// `No handler registered` 로 거절돼 저장 테마 대신 기본값이 남는다(이슈2).
//
// `Bootstrap` 은 DB·electron 을 끌고 와 vitest 에서 `start()` 를 돌릴 수 없다. 그래서 소스에서
// `start()` 본문을 잘라 **등록 호출이 존재하고 첫 `await` 보다 앞선다**를 본다 — 호출을 지우거나
// `await` 뒤로 옮기면 실패한다(plan VP-02 변이 ①·②).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

const BOOTSTRAP = join(__dirname, 'bootstrap.ts')

// `async start(): Promise<void> {` 여는 괄호부터 짝이 맞는 닫는 괄호까지 — 주석·문자열을
// 지운 뒤라 괄호 세기가 문자열 속 `{` 에 속지 않는다.
function startBody(source: string): string {
  const head = /\basync\s+start\s*\(\s*\)\s*:\s*Promise<void>\s*\{/.exec(source)
  if (!head) throw new Error('start() not found in bootstrap.ts')
  let depth = 0
  for (let i = head.index + head[0].length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(head.index, i + 1)
  }
  throw new Error('start() body is not balanced')
}

describe('Bootstrap.start — settings:get 조기 등록 (0244)', () => {
  const body = startBody(stripCommentsAndStrings(readFileSync(BOOTSTRAP, 'utf8')))

  it('start() 가 SettingsStore 로 읽기 핸들러를 등록한다', () => {
    expect(body).toMatch(/\bregisterSettingsReadHandler\s*\(\s*this\.settings\s*\)/)
  })

  it('등록 호출은 start() 의 첫 await 보다 앞선다 — 창이 뜨기 전 동기 구간', () => {
    const call = body.search(/\bregisterSettingsReadHandler\s*\(/)
    const firstAwait = body.search(/\bawait\b/)
    expect(call).toBeGreaterThan(-1)
    expect(firstAwait).toBeGreaterThan(-1)
    expect(call).toBeLessThan(firstAwait)
  })
})
