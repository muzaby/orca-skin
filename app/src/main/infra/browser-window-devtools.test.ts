// 0261 AC4 · EP-02 — **webContents 를 만드는 모든 생성자 자리**의 webPreferences 보안 베이스라인.
//
// production 빌드에서 DevTools 를 막는 장치는 창 옵션 `devTools: import.meta.env.DEV` 하나다(D-005) —
// 번들에서 false 로 접혀 메뉴·단축키·openDevTools 를 함께 무효화한다. 본창(`index.ts`)은 모듈 부작용이
// 커서 import 하는 테스트가 없으므로 자리를 소스에서 찾아 리터럴을 본다. 로그인 창의 실제 생성자 인자는
// `browser-session.devtools.test.ts` 가 행동으로 본다.
//
// **술어는 불변식의 주어(창 생성자 호출)로 쓴다** — 해법 이름(`devTools`)으로 세면 이미 고친 자리만
// 분모에 오른다. 값은 리터럴이 최종이어야 한다: 같은 키를 두 번 쓰거나 블록 안·뒤에 spread 를 두면
// 뒤의 값이 이긴다.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sourceFiles, stripCommentsAndStrings, toPosix } from './source-scan'

const MAIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const CTOR = /new\s+(?:[\w$]+\.)?(?:BrowserWindow|BrowserView|WebContentsView)\s*\(/g

// 키마다 허용하는 값은 하나다. `devTools` 는 상수가 아니라 빌드 상수 식이어야 dev 에서 열린다(R-03).
const REQUIRED: ReadonlyArray<readonly [string, RegExp]> = [
  ['devTools', /^import\.meta\.env\.DEV$/],
  ['contextIsolation', /^true$/],
  ['nodeIntegration', /^false$/],
  ['sandbox', /^true$/]
]

// 여는 괄호에서 짝이 맞는 닫는 괄호까지. 주석·문자열은 미리 비워 괄호가 섞이지 않는다.
function balanced(text: string, open: number): { body: string; end: number } | undefined {
  const closing: Record<string, string> = { '(': ')', '{': '}', '[': ']' }
  const stack: string[] = []
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c in closing) stack.push(closing[c])
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return undefined
      if (stack.length === 0) return { body: text.slice(open, i + 1), end: i + 1 }
    }
  }
  return undefined
}

interface Site {
  file: string
  args: string | undefined
}

function windowSites(): Site[] {
  return sourceFiles(MAIN_ROOT).flatMap((file) => {
    const src = stripCommentsAndStrings(readFileSync(file, 'utf8'))
    return [...src.matchAll(CTOR)].map((m) => ({
      file: toPosix(file.slice(MAIN_ROOT.length)),
      args: balanced(src, (m.index ?? 0) + m[0].length - 1)?.body
    }))
  })
}

// 위반 목록을 돌려준다 — 실패 메시지가 무엇이 틀렸는지 그대로 보이게 한다.
function violations(args: string | undefined): string[] {
  if (args === undefined) return ['생성자 인자의 괄호 짝을 찾지 못했다']
  const keys = [...args.matchAll(/\bwebPreferences\s*:\s*\{/g)]
  if (keys.length !== 1)
    return [`webPreferences 객체 리터럴 ${keys.length}개 — 정확히 1개여야 한다`]
  const key = keys[0]
  const block = balanced(args, (key.index ?? 0) + key[0].length - 1)
  if (!block) return ['webPreferences 블록의 괄호 짝을 찾지 못했다']
  const out: string[] = []
  if (block.body.includes('...'))
    out.push('webPreferences 안에 spread 가 있다 — 리터럴 값이 최종이 아니다')
  if (args.slice(block.end).includes('...'))
    out.push('webPreferences 뒤에 spread 가 있다 — 블록을 덮을 수 있다')
  for (const [name, value] of REQUIRED) {
    const found = [...block.body.matchAll(new RegExp(`\\b${name}\\s*:\\s*([^,}]*)`, 'g'))]
    if (found.length !== 1) out.push(`${name} ${found.length}회 — 정확히 1회여야 한다`)
    else if (!value.test(found[0][1].trim()))
      out.push(`${name}: ${found[0][1].trim()} — 기대 ${value.source}`)
  }
  return out
}

const SITES = windowSites()

describe('webContents 생성자 보안 베이스라인 (0261 AC4 · EP-02)', () => {
  it('스캔이 알려진 생성자 자리를 찾는다 — 추출이 눈을 잃으면 여기서 먼저 깨진다', () => {
    expect(SITES.map((s) => s.file)).toEqual(
      expect.arrayContaining(['index.ts', 'infra/browser-session.ts'])
    )
  })

  it.each(SITES.map((s) => [s.file, s] as const))(
    '%s — webPreferences 보안 베이스라인',
    (_file, site) => {
      expect(violations(site.args)).toEqual([])
    }
  )
})
