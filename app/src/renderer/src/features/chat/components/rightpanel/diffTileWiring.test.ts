// 0211 라운드 5 — D36·D37 / VP-97 · VP-99 · §10 EP-71 ③ · EP-73 ①.
//
// 두 계약이 **producer 를 지나지 않은 채** 잠겨 있었다.
//   · 선택 연동: `diffRequirementSelection.render.test.ts` 가 `DiffReview` 를 직접 렌더한다.
//     그래서 `DiffTileContent.activeRequirementId` 를 `null` 로 고정해도 green 이었다(M13) —
//     사용자가 코멘트를 눌러도 diff 쪽이 활성으로 바뀌지 않는데 게이트가 조용했다.
//   · 실패 재시도: `DiffTileContent` 의 `onRefresh` 배선을 지워도 green 이었다(M43) —
//     조회 실패 안내의 '새로 고침' 이 아무 데도 닿지 않는다.
//
// 여기서는 **타일 컨테이너를 지나** 잰다. 선택 축은 store → 실제 `DiffReview` 마크업까지,
// 재시도 축은 컨테이너가 건넨 콜백을 실제로 불러서 본다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import type { DiffRequirementItem, GitDiffPatch } from '../../../../../../shared/ipc'
import { DEFAULT_DIFF_VIEW, initialChatState, type ChatState } from '../../reducer/chatReducer'
import type { DiffReview as DiffReviewType } from './DiffReview'

const h = vi.hoisted(() => ({
  state: null as unknown as ChatState,
  refresh: vi.fn(),
  select: vi.fn(),
  props: null as unknown
}))

vi.mock('../../hooks/useGitPatch', () => ({ useGitPatch: () => undefined }))
vi.mock('../../../../shared/api/ipc', () => ({
  fileApi: { openPath: vi.fn(async () => undefined) },
  gitApi: { diffPatch: vi.fn(async () => null) }
}))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  useChatStore: (select: (state: { activeKey: string }) => unknown) => select({ activeKey: 's' }),
  chatActions: {
    refreshGitSnapshot: h.refresh,
    selectDiffRequirement: h.select,
    toggleDiffFileExpanded: vi.fn(),
    setDiffComparison: vi.fn(),
    setDiffRequirementDraft: vi.fn(),
    addDiffRequirement: vi.fn(),
    removeDiffRequirement: vi.fn()
  }
}))

// 실제 `DiffReview` 를 그대로 그리면서 컨테이너가 건넨 props 도 잡는다 — 마크업 축과 콜백
// 축이 같은 렌더에서 나온다(대역으로 갈아끼우면 소비자 쪽이 안 잠긴다).
vi.mock('./DiffReview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./DiffReview')>()
  return {
    DiffReview: (props: ComponentProps<typeof DiffReviewType>) => {
      h.props = props
      return createElement(actual.DiffReview, props)
    }
  }
})

import { DiffTileContent } from './DiffTileContent'

const item = (id: string, line: number): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'base',
    filePath: 'src/a.ts',
    oldLine: line,
    newLine: line,
    hunkHeader: '',
    contextBefore: [],
    contextAfter: [],
    comment: `Comment ${id}`,
    createdAt: 1
  }
})

const PATCH: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'head', oid: 'base' },
  filesTruncated: false,
  contextLimited: false,
  unavailable: false,
  files: [
    {
      path: 'src/a.ts',
      status: 'modified',
      added: 1,
      removed: 0,
      kind: 'text',
      lines: [
        { type: 'added', oldLine: null, newLine: 1, text: 'one' },
        { type: 'unchanged', oldLine: 2, newLine: 2, text: 'two' },
        { type: 'unchanged', oldLine: 3, newLine: 3, text: 'three' }
      ]
    }
  ]
}

function seed(overrides: Partial<ChatState> = {}): void {
  h.state = {
    ...initialChatState,
    sessionId: 's',
    cwd: '/repo',
    gitSnapshotRequest: { key: 'repo-s', generation: 1 },
    gitSnapshot: {
      ...initialChatState.gitSnapshot,
      patch: PATCH,
      expandedFiles: ['src/a.ts'],
      view: DEFAULT_DIFF_VIEW
    },
    ...overrides
  } as ChatState
}

/** 한 번 그리고, 그 렌더에서 컨테이너가 건넨 props 를 함께 돌려준다. */
function renderTile(): { html: string; props: ComponentProps<typeof DiffReviewType> } {
  h.props = null
  const html = renderToStaticMarkup(createElement(DiffTileContent))
  expect(h.props, 'DiffTileContent 가 DiffReview 를 그리지 않았다').not.toBeNull()
  return { html, props: h.props as ComponentProps<typeof DiffReviewType> }
}

beforeEach(() => {
  h.refresh.mockReset()
  h.select.mockReset()
  h.props = null
  seed()
})

describe('선택 연동이 타일 컨테이너를 지난다 (D37 · VP-97 · EP-71 ③)', () => {
  it('store 의 활성 코멘트 하나만 실제 diff 본문에서 활성으로 그려진다', () => {
    seed({ diffRequirements: [item('one', 2), item('two', 3)], activeDiffRequirementId: 'two' })

    const $ = load(renderTile().html)

    expect($('[data-diff-requirement-marker="two"] button').first().attr('aria-pressed')).toBe(
      'true'
    )
    expect($('[data-diff-requirement-marker="one"] button').first().attr('aria-pressed')).toBe(
      'false'
    )
  })

  it('활성 항목을 바꾸면 활성 표시도 따라 옮겨간다 — 상수로 고정하면 갈린다', () => {
    seed({ diffRequirements: [item('one', 2), item('two', 3)], activeDiffRequirementId: 'one' })

    const $ = load(renderTile().html)

    expect($('[data-diff-requirement-marker="one"] button').first().attr('aria-pressed')).toBe(
      'true'
    )
    expect($('[data-diff-requirement-marker="two"] button').first().attr('aria-pressed')).toBe(
      'false'
    )
  })

  it('선택이 없으면 어느 항목도 활성이 아니다 — 양성 짝의 음성 축', () => {
    seed({ diffRequirements: [item('one', 2), item('two', 3)], activeDiffRequirementId: null })

    const $ = load(renderTile().html)

    expect($('[data-diff-requirement-marker] button[aria-pressed="true"]')).toHaveLength(0)
    expect($('[data-diff-requirement-marker] button[aria-pressed="false"]')).toHaveLength(2)
  })

  it('코멘트를 누르면 store 의 선택 액션이 그 id 로 불린다', () => {
    seed({ diffRequirements: [item('one', 2)], activeDiffRequirementId: null })

    renderTile().props.onSelectRequirement!('one')

    expect(h.select).toHaveBeenCalledExactlyOnceWith('one')
  })
})

describe('조회 실패 재시도가 타일 컨테이너를 지난다 (D36 · VP-99 · EP-73 ①)', () => {
  it('실패 안내의 새로 고침이 store 액션까지 닿는다', () => {
    seed({ gitSnapshot: { ...initialChatState.gitSnapshot, error: 'status' } as never })

    const tile = renderTile()
    expect(load(tile.html)('[data-diff-error] button')).toHaveLength(1)

    tile.props.onRefresh!()
    expect(h.refresh).toHaveBeenCalledExactlyOnceWith()
  })
})
