// 0211 VP-13 — 예시 데이터 표면이 제품에서 사라졌는가.
//
// **0건 스윕 단독으로는 "실데이터가 붙었다" 를 증명하지 못한다** — mock 을 지우고 아무것도
// 붙이지 않아도 초록이다. 그래서 plan 은 이것을 AT-09·AT-10 의 양성 단언과 짝지었고
// (`git-diff.test.ts` 14케이스), 여기서는 잔여물만 센다.
//
// **술어는 불변식의 주어로 쓴다**: 불변식은 "예시 모듈을 *가져다 쓰는* 코드가 없다" 이지
// "그 이름이 아무 데도 없다" 가 아니다. 후자로 세면 이 파일 자신과 이력을 적은 주석이
// 잡혀, 분모를 파일 이름으로 깎아내는(=해법 이름으로 세는) 유혹이 생긴다. import 구문을
// 술어로 쓰면 그 깎기가 필요 없다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../../../../../../', import.meta.url))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

// 경로는 POSIX 구분자로 정규화해 들고 있는다 — Windows 의 역슬래시로 두면 아래 술어가
// 플랫폼마다 다른 것을 세고, 그 차이는 조용히 분모를 0으로 만든다(0208 AT-29 선례).
const files = walk(SRC).map((path) => ({
  path: path.slice(SRC.length).split('\\').join('/'),
  text: readFileSync(path, 'utf8')
}))

// 예시 모듈을 가리키는 import/require 구문만 — 이력을 적은 산문 주석은 참조가 아니다.
// (예시 문자열은 아래 감도 fixture 가 조립해서 만든다: 여기 그대로 적으면 자기 자신이 잡힌다.)
const IMPORTS_MOCK = /(?:from|require\()\s*['"][^'"]*diffTile(?:)Mock['"]/

// 감도 fixture 는 **쪼개서 만든다** — 살아 있는 import 문자열을 이 파일에 그대로 적으면
// 스윕이 자기 자신을 잡고, 그러면 분모를 파일 이름으로 깎게 된다(위 헤더의 그 유혹).
const MOCK_MODULE = `diffTile${'Mock'}`
const NOTICE_KEY = `diffMock${'Notice'}`

describe('예시 표면 소멸 (VP-13)', () => {
  it('스윕이 실제로 소스를 본다 — 분모가 0이면 아래 0건은 아무 말도 하지 않는다', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('스윕에 눈이 있다 — 살아 있는 import 는 잡고 이력 주석은 잡지 않는다', () => {
    expect(IMPORTS_MOCK.test(`import { X } from './${MOCK_MODULE}'`)).toBe(true)
    expect(IMPORTS_MOCK.test(`const y = require('../${MOCK_MODULE}')`)).toBe(true)
    expect(IMPORTS_MOCK.test(`// 0206 의 ${MOCK_MODULE} 자리를 대신한다`)).toBe(false)
  })

  it('예시 데이터 모듈을 import 하는 파일이 없다', () => {
    expect(files.filter((f) => IMPORTS_MOCK.test(f.text)).map((f) => f.path)).toEqual([])
  })

  it('예시 안내 i18n 키가 카탈로그에 남아 있지 않다', () => {
    const catalogs = files.filter((f) => /i18n\/resources\/(ko|en)\.ts$/.test(f.path))
    // 카탈로그를 실제로 집었는지 먼저 본다 — 0건이면 아래 단언이 공허하게 참이다.
    expect(catalogs).toHaveLength(2)
    expect(catalogs.filter((f) => f.text.includes(NOTICE_KEY)).map((f) => f.path)).toEqual([])
  })

  it('그 키를 번역하는 호출부도 없다', () => {
    const callers = files.filter((f) => new RegExp(`tr\\(['"][^'"]*${NOTICE_KEY}`).test(f.text))
    expect(callers.map((f) => f.path)).toEqual([])
  })
})
