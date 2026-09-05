// 0211 라운드 6 — §10 EP-71 ④ / VP-97 · D-147.
//
// 선택한 코멘트를 **보이는 자리로 옮기는** 배선이 무관측이었다. `revealDiffRequirement` 자신은
// `diffRequirementScroll.test.ts` 가 잠그는데, 그것을 부르는 `FileDiffSection` 의 인자를
// 상수로 바꿔도(S1) 3,366 케이스가 전부 초록이었다 — 코멘트를 눌러도 화면이 그 자리로 가지
// 않는데 게이트가 조용하다.
//
// SSR 은 effect 를 돌리지 않는다. `useEffect`·`useLayoutEffect` 만 대역으로 세워 모아 두고,
// 실제 렌더가 끝난 뒤 그대로 실행한다 — 나머지 훅은 SSR 디스패처의 진짜 훅이다.
//
// **라운드 7(D49)**: fixture 가 `scrollOwnerRef: { current: null }` 을 넣어 첫 인자를 죽였다. 그래서
// `scrollOwnerRef.current` 를 `null` 로 굳힌 변이(V2)가 green 이었다 — 어느 컨테이너를 스크롤할지
// 잃어도 사용자에게는 S1 과 같은 결과다. 센티널을 넣어 **그 인자가 실제로 운반되는지**를 잰다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DiffRequirementItem, GitDiffPatchLine } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW } from '../../reducer/chatReducer'

const h = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], reveal: vi.fn() }))

/** 스크롤 대상 컨테이너의 자리표시자 — 이 객체가 그대로 `revealDiffRequirement` 에 닿아야 한다. */
const OWNER = { sentinel: 'scroll-owner' } as unknown as HTMLDivElement

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  return {
    ...real,
    useEffect: (run: () => void | (() => void)) => {
      h.effects.push(run)
    },
    useLayoutEffect: (run: () => void | (() => void)) => {
      h.effects.push(run)
    }
  }
})
vi.mock('../../lib/diffRequirementScroll', () => ({ revealDiffRequirement: h.reveal }))
vi.mock('../../hooks/useDiffSyntax', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks/useDiffSyntax')>()),
  useDiffSyntax: () => new Map()
}))

import { FileDiffSection } from './FileDiffSection'

const LINES: GitDiffPatchLine[] = [
  { type: 'added', oldLine: null, newLine: 1, text: 'alpha' },
  { type: 'unchanged', oldLine: 2, newLine: 2, text: 'beta' }
]

const item = (id: string, newLine: number, filePath = 'src/a.ts'): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'base',
    filePath,
    oldLine: null,
    newLine,
    hunkHeader: '',
    contextBefore: [],
    contextAfter: [],
    comment: `Comment ${id}`,
    createdAt: 1
  }
})

/** 렌더하고, 그 렌더가 등록한 effect 를 전부 실행한다. */
function renderAndRunEffects(
  requirements: readonly DiffRequirementItem[],
  activeRequirementId: string | null
): void {
  h.effects = []
  renderToStaticMarkup(
    createElement(FileDiffSection, {
      section: {
        path: 'src/a.ts',
        added: 1,
        removed: 0,
        patch: {
          path: 'src/a.ts',
          status: 'modified',
          kind: 'text',
          added: 1,
          removed: 0,
          lines: LINES
        }
      },
      collapsed: false,
      view: DEFAULT_DIFF_VIEW,
      requirements,
      draft: null,
      activeRequirementId,
      selectionVersion: 1,
      scrollOwnerRef: { current: OWNER },
      tailSpacerRef: { current: null },
      onToggleCollapsed: () => {},
      onOpenFile: () => {}
    })
  )
  expect(h.effects.length, 'FileDiffSection 이 effect 를 등록하지 않았다').toBeGreaterThan(0)
  for (const run of h.effects) run()
}

beforeEach(() => {
  h.reveal.mockReset()
  h.reveal.mockReturnValue(true)
})

describe('선택한 코멘트를 그 자리로 드러낸다 (EP-71 ④ · VP-97 · D-147)', () => {
  it('활성 코멘트의 id 로 드러낸다', () => {
    renderAndRunEffects([item('one', 1), item('two', 2)], 'one')

    expect(h.reveal).toHaveBeenCalledExactlyOnceWith(OWNER, 'one')
  })

  it('활성 항목이 바뀌면 그 id 로 옮겨간다 — 상수로 고정하면 갈린다', () => {
    renderAndRunEffects([item('one', 1), item('two', 2)], 'two')

    expect(h.reveal).toHaveBeenCalledExactlyOnceWith(OWNER, 'two')
  })

  it('선택이 없으면 화면을 움직이지 않는다 — 양성 짝의 음성 축', () => {
    renderAndRunEffects([item('one', 1), item('two', 2)], null)

    expect(h.reveal).not.toHaveBeenCalled()
  })

  it('스크롤 대상 컨테이너를 그대로 운반한다 — 인자를 상수로 굳히면 갈린다 (D49)', () => {
    renderAndRunEffects([item('one', 1)], 'one')

    expect(h.reveal.mock.calls[0]![0]).toBe(OWNER)
    expect(h.reveal.mock.calls[0]![0]).not.toBeNull()
  })

  it('다른 파일의 코멘트가 선택돼 있으면 이 파일은 움직이지 않는다', () => {
    renderAndRunEffects([item('other', 1, 'src/b.ts')], 'other')

    expect(h.reveal).not.toHaveBeenCalled()
  })
})
