// 0211 ΔV3 AT-41 / §10 EP-27 — 변경사항 패널이 **형제 패널의 primitive** 를 쓴다.
//
// 이 스윕은 **구조**만 센다. "형제와 나란히 놓았을 때 이질감이 없는가" 는 여기서 세지 못하고
// §19 사람 실기 1건이 갖는다(D-067). 그 차이를 알고 쓴다.
//
// 총량이 아니라 **대응**으로 센다: hover 하는 자리마다 전이가 있는가, 이름 붙은 group 이
// 실제로 있는가. 총량으로 세면 한 자리만 빠진 것이 보이지 않는다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (name: string): string => readFileSync(join(HERE, name), 'utf8')

const PANELS = ['SessionChangesList.tsx', 'DiffPeek.tsx'] as const
const CLASS_LITERAL = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g
const TRANSITION = /transition-(colors|opacity|transform|\[)/

const classNames = (source: string): string[] =>
  [...source.matchAll(CLASS_LITERAL)].map((m) => m[1] ?? m[2] ?? '')

describe.each(PANELS)('%s — 형제 primitive (AT-41)', (file) => {
  const source = read(file)

  it('Icon 을 쓴다 — 같은 뜻의 컨트롤이 패널마다 다른 모양이 되지 않는다', () => {
    expect(source).toContain("from '../../../../shared/ui/Icon'")
    expect(source.match(/<Icon\b/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('hover 하는 자리마다 전이가 있다 — 차집합 0', () => {
    const hovers = classNames(source).filter((c) => c.includes('hover:'))
    // 대상 집합이 비면 스윕은 아무것도 보지 않는다.
    expect(hovers.length).toBeGreaterThan(0)
    const withoutTransition = hovers.filter((c) => !TRANSITION.test(c))
    expect(withoutTransition).toEqual([])
  })

  it('group 스코프에 이름이 있고 실제로 선언돼 있다', () => {
    // 익명 `group-hover:` 는 상위의 다른 `.group` 까지 매칭된다(renderer AGENTS §그룹 스코프).
    expect(source.match(/(?<!\/)\bgroup-hover:/g)).toBeNull()
    const used = [...source.matchAll(/group-hover\/([a-z]+):/g)].map((m) => m[1])
    const declared = new Set([...source.matchAll(/\bgroup\/([a-z]+)\b/g)].map((m) => m[1]))
    const undeclared = [...new Set(used)].filter((name) => !declared.has(name))
    expect(undeclared).toEqual([])
  })
})

describe('접기 컨트롤이 house 형태다 (AT-41 · EP-27 ③)', () => {
  it('SessionChangesList 의 파일 접기가 button + aria-expanded + chevron 회전이다', () => {
    const source = read('SessionChangesList.tsx')

    expect(source).toContain('aria-expanded={expanded}')
    expect(source).toContain('name="chevD"')
    // 열림/닫힘이 **회전으로 갈린다** — 붙였는지가 아니라 갈리는지가 계약이다.
    expect(source).toContain("expanded ? '' : '-rotate-90'")
    expect(source).toContain('motion-reduce:transition-none')
  })

  it('섹션 제목 타이포가 형제 타일(TaskTileSections)과 같다', () => {
    const sibling = readFileSync(join(HERE, 'TaskTileSections.tsx'), 'utf8')
    const token = /text-footnote font-medium text-t9/
    expect(sibling).toMatch(token)
    expect(read('SessionChangesList.tsx')).toMatch(token)
    // 이 패널만 쓰던 표제 서체가 남아 있지 않다.
    expect(read('SessionChangesList.tsx')).not.toContain('font-serif')
  })
})
