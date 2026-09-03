// 0215 ΔV1 · VP-21 (AR-04 ↔ IT · §10 EP-20·EP-21) — `Composer` 가 선택 모델에서 파생한 값을
// 메뉴/스토어로 **공급하는지**를 관측한다.
//
// 왜 소스 단언인가(D-018): 이 배선은 `Popover` 안에 있고 `Popover` 는 `createPortal(…,
// document.body)` 다. vitest 설정이 `environment: 'node'` 라 `typeof document === 'undefined'`
// 이고 portal 은 `Target container is not a DOM element` 로 던진다 — 마운트 관측이 불가능하다.
// 대체 수단(DOM 환경 도입)은 신규 의존성이라 plan D-020 에서 OPEN 이다.
//
// 한계: 식별자 rename 에 취약하다. 다만 그때는 단언이 깨져 **red 로 드러나므로 침묵이 아니다**
// (§10 EP-20 `실패 의미`).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(fileURLToPath(new URL('../Composer.tsx', import.meta.url)), 'utf8')

// `<Tag …>` 의 여는 태그를 중괄호 깊이로 스캔해 잘라낸다. `onPick={(m) => …}` 의 `=>` 가
// 깊이 밖의 `>` 로 오인되지 않게 depth 0 의 `>` 에서만 멈춘다.
function openingTag(source: string, tag: string): string {
  const start = source.indexOf(`<${tag}`)
  expect(start, `<${tag} 가 소스에 없다`).toBeGreaterThanOrEqual(0)
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`<${tag} 의 여는 태그가 닫히지 않는다`)
}

// `name(` 의 괄호를 깊이로 스캔해 인자 목록 원문을 돌려준다(중첩 호출 허용).
function callArgs(source: string, name: string): string[] {
  const calls: string[] = []
  const needle = `${name}(`
  for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + 1)) {
    // `setModel(` 앞이 식별자 문자면 다른 이름의 꼬리다(`useSetModel(` 등).
    if (/[A-Za-z0-9_$.]/.test(source[at - 1] ?? '')) continue
    let depth = 0
    for (let i = at + needle.length - 1; i < source.length; i += 1) {
      const ch = source[i]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          calls.push(source.slice(at + needle.length, i))
          break
        }
      }
    }
  }
  return calls
}

// 최상위 콤마로만 가른다 — `modelKey(model)` 안의 콤마에 걸리지 않는다.
function topLevelArgs(argText: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of argText) {
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() !== '') out.push(current.trim())
  return out
}

describe('0215 AT-23 — Composer 가 선택 모델 파생값을 메뉴/스토어로 공급한다', () => {
  it('축① ModeMenu 에 선택 모델에서 파생한 options 를 넘긴다', () => {
    const tag = openingTag(SOURCE, 'ModeMenu')
    // 배선 단언 — `options` prop 을 지우면 red 다(verify r1 M-B).
    expect(tag).toMatch(/options=\{\s*modeMenuOptions\(/)
    // 인자가 선택 모델에서 온다 — 상수 목록을 넘기는 회귀도 red 다.
    expect(tag).toMatch(/modeMenuOptions\(\s*selectedModelShape\([^)]*selectedModel\s*\)/)
  })

  it('축② selectedModel memo 가 선택 상태 3필드를 싣는다 (§10 EP-20c)', () => {
    const memo = callArgs(SOURCE, 'useMemo').find((args) => args.includes('providerKey,'))
    expect(memo, 'selectedModel memo 를 찾지 못했다').toBeDefined()
    // 세 필드 각각이 축약 속성으로 실려야 한다 — 하나만 봐도 나머지 축은 침묵한다.
    for (const field of ['providerKey', 'modelFamily', 'modelAlias'] as const) {
      // 배선 단언 — 축약이 사라지거나 `null` 로 바뀌면 red 다(verify r1 M-H).
      expect(memo!, `memo 가 ${field} 를 축약 속성으로 싣지 않는다`).toMatch(
        new RegExp(`(^|[\\s{,])${field}\\s*(,|$)`, 'm')
      )
      expect(memo!, `memo 의 ${field} 가 상수다`).not.toMatch(
        new RegExp(`${field}\\s*:\\s*(null|undefined)`)
      )
      // memo 가 그 값에 반응한다 — 의존성 배열에서 빠지면 stale 이다.
      expect(memo!, `의존성 배열에 ${field} 가 없다`).toMatch(
        new RegExp(`\\[[^\\]]*\\b${field}\\b[^\\]]*\\]`)
      )
    }
  })

  // D-022 — `setModel` 은 4슬롯 **순서 계약**이다. 한 슬롯만 단언하면 형제 슬롯 오염이
  // 침묵한다: arg3 을 alias 로 둔 채 arg2 만 alias 로 바꾸면 `selectionExists` 가 거짓이 되어
  // 복구 effect 가 사용자 선택을 default 로 되돌린다(verify r2 V-5 · §8 F-23).
  it('축③ setModel 호출 전건이 (providerKey, modelFamily, modelAlias, adapter) 를 그 순서로 넘긴다', () => {
    const calls = callArgs(SOURCE, 'setModel')
    // 분모 고정(§10 EP-20b) — 호출부가 늘면 이 줄이 red 가 되어 새 지점도 검사에 들어온다.
    expect(calls).toHaveLength(3)
    const SLOTS = [
      { name: 'providerKey', re: /providerKey$/ },
      // 두 번째 슬롯은 **모델 식별자** 다 — `modelKey(model)` 도 같은 계약이다(0215 D-007).
      { name: 'modelFamily', re: /(modelFamily$|^modelKey\()/ },
      { name: 'modelAlias', re: /([Aa]lias$)/ },
      { name: 'adapter', re: /adapter$/ }
    ]
    for (const [i, call] of calls.entries()) {
      const args = topLevelArgs(call)
      expect(args, `호출 ${i + 1} 의 인자 수`).toHaveLength(4)
      for (const [slot, { name, re }] of SLOTS.entries()) {
        expect(args[slot], `호출 ${i + 1} 의 ${slot + 1}번째 슬롯이 ${name} 이 아니다`).toMatch(re)
      }
    }
  })

  // AC25(ΔV2) — verify r2 V-1: 이 배선을 `null` 로 바꿔도 844/844 green 이었다.
  // 끊기면 `ModelMenu.tsx:49` 의 활성 행 판정이 죽어 어느 모델이 선택됐는지 안 보인다.
  it('축④ ModelMenu 에 선택 모델을 넘긴다 (§10 EP-20a)', () => {
    const tag = openingTag(SOURCE, 'ModelMenu')
    expect(tag).toMatch(/selection=\{\s*selectedModel\s*\}/)
  })
})
