// 0206 — diff 타일의 **3영역 배치와 버튼 구성**을 렌더 출력으로 잠근다.
//
// 내용은 전부 예시(`diffTileMock`)지만 *배치* 는 계약이다. 존재만 단언하면 좌우를 맞바꾼
// 회귀가 통과하므로 영역 마커의 **출현 인덱스**로 순서까지 본다(AT-11).
//
// props-only View 만 직접 렌더한다 — store 연결 래퍼는 SSR 스냅샷을 받아 시드가 반영되지
// 않는다(0204 선례).

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DiffCommitList, DiffFileHeaders, DiffFileTree, DiffTileContent } from './DiffTileContent'
import { DiffBody } from '../transcript/tool-bodies/DiffBody'
import type { ToolCall } from '../../reducer/chatReducer'
import { DiffTileHeaderView } from './DiffTileHeader'
import { MOCK_COMMITS, MOCK_FILES, MOCK_TREE } from './diffTileMock'
import { tileById } from './tileRegistry'

const SAMPLE = 'src/renderer/src/features/sample/components/SampleView.tsx'
const count = (html: string, needle: RegExp): number => html.match(needle)?.length ?? 0

const renderFiles = (expanded: string[]): string =>
  renderToStaticMarkup(
    createElement(DiffFileHeaders, {
      files: MOCK_FILES,
      expanded: new Set(expanded),
      onToggle: () => undefined
    })
  )

const renderHeader = (filesVisible: boolean, branch: string | null = 'main'): string =>
  renderToStaticMarkup(
    createElement(DiffTileHeaderView, { branch, filesVisible, onToggleFiles: () => undefined })
  )

describe('diff 타일 — 3영역 배치 (AT-11)', () => {
  it('트리 → 커밋 → 파일 항목 순서로 온다', () => {
    const tree = renderToStaticMarkup(
      createElement(DiffFileTree, {
        rows: MOCK_TREE,
        collapsed: new Set<string>(),
        onToggleDir: () => undefined
      })
    )
    const commits = renderToStaticMarkup(
      createElement(DiffCommitList, {
        commits: MOCK_COMMITS,
        selected: null,
        onSelect: () => undefined
      })
    )
    const files = renderFiles([])
    // 세 영역이 각자 자기 마커를 갖는다 — 래퍼가 순서를 바꿔도 마커로 식별된다.
    expect(tree).toContain('data-diff-region="tree"')
    expect(commits).toContain('data-diff-region="commits"')
    expect(files).toContain('data-diff-region="files"')
    const composed = tree + commits + files
    expect(composed.indexOf('region="tree"')).toBeLessThan(composed.indexOf('region="commits"'))
    expect(composed.indexOf('region="commits"')).toBeLessThan(composed.indexOf('region="files"'))
  })

  it('파일 행은 chevron 자리에 스페이서를 둬 이름 시작점을 맞춘다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffFileTree, {
        rows: MOCK_TREE,
        collapsed: new Set<string>(),
        onToggleDir: () => undefined
      })
    )
    // 파일 3건 = 스페이서 3건. 디렉토리는 chevron 을 가지므로 스페이서를 갖지 않는다.
    expect(count(html, /w-3 shrink-0"/g)).toBe(3)
    expect(count(html, /aria-expanded=/g)).toBe(4)
  })
})

describe('diff 타일 — 파일 항목 접기/펼치기 (AT-17)', () => {
  it('기본은 접힘이고 본문을 그리지 않는다', () => {
    const html = renderFiles([])
    expect(count(html, /<table/g)).toBe(0)
    expect(count(html, /aria-expanded="true"/g)).toBe(0)
    expect(count(html, /aria-expanded="false"/g)).toBe(MOCK_FILES.length)
  })

  it('양성 짝 — 펼친 항목만 본문을 갖는다', () => {
    const html = renderFiles([SAMPLE])
    expect(count(html, /<table/g)).toBe(1)
    expect(count(html, /aria-expanded="true"/g)).toBe(1)
    expect(count(html, /aria-expanded="false"/g)).toBe(MOCK_FILES.length - 1)
  })
})

describe('diff 타일 — 펼친 본문이 diff 다 (AT-18)', () => {
  it('추가·삭제 거터가 함께 나온다 — 파일 목록이 아니라 diff 를 그린다', () => {
    const html = renderFiles([SAMPLE])
    // `DiffTable` 의 거터 셀 — `+`/`-` 가 각각 최소 1건.
    expect(count(html, />\+<\/pre>/g)).toBeGreaterThanOrEqual(1)
    expect(count(html, />-<\/pre>/g)).toBeGreaterThanOrEqual(1)
    // 본문 줄이 실제 파일 내용이다 — 헤더의 수치가 아니다.
    expect(html).toContain('const rows = useRows(filter)')
  })

  it('접혀 있으면 거터도 본문도 없다 — 음성 짝', () => {
    const html = renderFiles([])
    expect(count(html, />\+<\/pre>/g)).toBe(0)
    expect(html).not.toContain('const rows = useRows(filter)')
  })
})

describe('diff 타일 — 커밋 선택 (AT-15)', () => {
  it('정확히 하나만 눌린 상태다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffCommitList, {
        commits: MOCK_COMMITS,
        selected: MOCK_COMMITS[1].sha,
        onSelect: () => undefined
      })
    )
    expect(count(html, /aria-pressed="true"/g)).toBe(1)
    expect(count(html, /aria-pressed="false"/g)).toBe(MOCK_COMMITS.length)
    expect(html).toContain(MOCK_COMMITS[1].sha)
  })

  it('기본은 전체 변경이 눌린 상태다', () => {
    const html = renderToStaticMarkup(
      createElement(DiffCommitList, {
        commits: MOCK_COMMITS,
        selected: null,
        onSelect: () => undefined
      })
    )
    expect(html.indexOf('aria-pressed="true"')).toBeLessThan(html.indexOf(MOCK_COMMITS[0].sha))
  })
})

describe('diff 타일 헤더 — 그리지 않는 자리 (AT-13)', () => {
  it('설정 메뉴·펼치기·이동 핸들이 없다', () => {
    const html = renderHeader(true)
    expect(html).not.toContain('aria-haspopup="menu"')
    expect(html).not.toContain('펼치기')
    expect(html).not.toContain('tiles-drag-handle')
  })

  it('양성 짝 — 파일 토글 버튼 하나와 현재 브랜치가 있다', () => {
    const html = renderHeader(true, 'claude/0206')
    expect(count(html, /<button/g)).toBe(1)
    expect(html).toContain('claude/0206')
  })

  it('토글은 눌림 상태를 표현한다 (AT-14 의 렌더 절)', () => {
    expect(renderHeader(true)).toContain('aria-pressed="true"')
    expect(renderHeader(false)).toContain('aria-pressed="false"')
  })
})

describe('diff 타일 — 예시 표식 (AT-12)', () => {
  it('본문 최상단이 예시임을 말한다 — 더미가 실제 변경으로 읽히지 않게 하는 유일한 자리다', () => {
    const html = renderToStaticMarkup(createElement(DiffTileContent))
    expect(html).toContain('실제 변경 내용이 아닙니다')
    // 표식이 본문 맨 앞이다 — 스크롤해야 보이면 그 역할을 못 한다.
    expect(html.indexOf('실제 변경 내용이 아닙니다')).toBeLessThan(html.indexOf('data-diff-region'))
  })
})

describe('줄 렌더 SSOT — 도구 카드 회귀 (AT-19)', () => {
  const call = (over: Partial<ToolCall> = {}): ToolCall =>
    ({ name: 'Edit', input: { old_string: 'a\nb\n', new_string: 'a\nc\n' }, ...over }) as ToolCall

  it('도구 카드 diff 가 승격 후에도 같은 표를 그린다', () => {
    const html = renderToStaticMarkup(createElement(DiffBody, { call: call() }))
    expect(count(html, /<table/g)).toBe(1)
    expect(count(html, />\+<\/pre>/g)).toBe(1)
    expect(count(html, />-<\/pre>/g)).toBe(1)
    expect(html).toContain('>c</pre>')
  })

  it('타일과 도구 카드가 같은 거터 마크업을 낸다 — 규칙이 두 벌이 아니다', () => {
    const card = renderToStaticMarkup(createElement(DiffBody, { call: call() }))
    const tile = renderFiles([SAMPLE])
    for (const marker of ['<table class="w-full border-collapse font-mono"', 'text-code text-t9']) {
      expect(card).toContain(marker)
      expect(tile).toContain(marker)
    }
  })

  it('diff 쌍이 없는 도구 입력은 원문으로 떨어진다 — 기존 폴백 유지', () => {
    const html = renderToStaticMarkup(
      createElement(DiffBody, { call: call({ name: 'Bash', input: { command: 'ls' } }) })
    )
    expect(count(html, /<table/g)).toBe(0)
    expect(html).toContain('ls')
  })
})

// 위 AT-13 은 **View 를 직접** 렌더하므로 레지스트리 배선이 끊겨도 초록이다 —
// `headerContentById` 는 `Partial<Record>` 라 키를 빠뜨려도 컴파일된다(§10 EP-02④).
// 그 자리를 여기서 따로 잠근다(구현 턴 §3 적대 검사에서 드러난 구멍).
describe('diff 타일 — 레지스트리 배선 (EP-02③④)', () => {
  it('본문과 헤더 override 가 모두 등록돼 있다', () => {
    const tile = tileById('diff')
    expect(tile.id).toBe('diff')
    expect(tile.Content).toBeDefined()
    expect(tile.HeaderContent).toBeDefined()
  })

  it('등록된 헤더가 실제로 파일 토글을 그린다 — 기본 라벨로 떨어지지 않는다', () => {
    const Header = tileById('diff').HeaderContent
    expect(Header).toBeDefined()
    const html = renderToStaticMarkup(createElement(Header!))
    expect(html).toContain('파일 목록 숨기기')
    expect(count(html, /<button/g)).toBe(1)
  })

  it('등록된 본문이 3영역을 그린다', () => {
    const html = renderToStaticMarkup(createElement(tileById('diff').Content))
    expect(html).toContain('data-diff-region="tree"')
    expect(html).toContain('data-diff-region="commits"')
    expect(html).toContain('data-diff-region="files"')
  })

  // AT-17 은 View 에 `expanded` 를 주입하므로 **래퍼의 기본값**은 잠기지 않는다 — 래퍼가
  // 전부 펼친 채로 시작해도 초록이다. 기본 접힘은 여기서 본다(같은 구멍의 두 번째 자리).
  it('래퍼는 전부 접힌 채로 시작한다 — 열려면 사용자가 눌러야 한다', () => {
    const html = renderToStaticMarkup(createElement(tileById('diff').Content))
    expect(count(html, /<table/g)).toBe(0)
    expect(count(html, /aria-expanded="true"/g)).toBe(
      MOCK_TREE.filter((r) => r.kind === 'dir').length
    )
  })
})
