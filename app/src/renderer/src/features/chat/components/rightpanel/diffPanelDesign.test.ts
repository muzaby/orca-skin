// 0211 ΔV3 AT-41 / §10 EP-27 — 변경사항 패널이 **형제 패널의 primitive** 를 쓴다.
// ΔV4 가 대상 집합을 새 컴포넌트 넷으로 넓힌다 — 화면이 바뀌어도 같은 불변식이 걸린다.
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

// **상호작용 행을 그리는** 컴포넌트만 primitive 대응을 센다. `DiffReview` 는 배치와 상태
// 분기만 가져 hover 행이 0이고, 그 파일에 hover 를 요구하면 장식을 붙이게 만든다 — 대신
// 익명 group 금지는 넷 전부에 걸린다(아래 별도 describe).
const PANELS = ['GitContextBar.tsx', 'ChangedNavigationSidebar.tsx', 'FileDiffSection.tsx'] as const
const ALL_PANELS = [...PANELS, 'DiffReview.tsx'] as const
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

describe.each(ALL_PANELS)('%s — 익명 group 금지', (file) => {
  it('상위의 다른 .group 까지 매칭되는 익명 group-hover 를 쓰지 않는다', () => {
    // (`src/renderer/AGENTS.md §그룹 스코프 격리`) — 형제 인스턴스가 함께 반응하는 버그의 원인.
    expect(read(file).match(/(?<!\/)\bgroup-hover:/g)).toBeNull()
  })
})

describe('접기 컨트롤이 house 형태다 (AT-41 · EP-27 ③)', () => {
  it('파일 섹션의 접기가 button + aria-expanded + 아이콘 갈림이다', () => {
    const source = read('FileDiffSection.tsx')

    expect(source).toContain('aria-expanded={!collapsed}')
    // 열림/닫힘이 **아이콘으로 갈린다** — 붙였는지가 아니라 갈리는지가 계약이다.
    expect(source).toContain("collapsed ? 'chevR' : 'chevD'")
  })

  it('사이드바의 폴더 접기도 같은 형태다 — 두 접기가 서로 다른 모양이 되지 않는다', () => {
    const source = read('ChangedNavigationSidebar.tsx')

    expect(source).toContain('aria-expanded={!collapsed}')
    expect(source).toContain("collapsed ? 'chevR' : 'chevD'")
  })

  it('연출은 저장소의 기존 상수를 승계한다 (D-092)', () => {
    // 새 시간축을 만들지 않는다 — `animate-depth-in` 은 `app.css` 의 180ms utility 다.
    expect(read('ChangedNavigationSidebar.tsx')).toContain('animate-depth-in')
  })
})
