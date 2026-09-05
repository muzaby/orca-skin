// 0211 라운드 6 — D47 / VP-97 · §10 EP-71 ② · D-147.
//
// D-147 은 composer 와 diff 두 표면의 선택이 **함께** 움직이는 것이다. r5 는 diff 쪽만
// 컨테이너를 지나 잠갔다(`diffTileWiring.test.ts`). composer 쪽 유일한 오라클
// `RequirementTray.render.test.ts` 는 트레이에 props 를 **직접** 건네 그리므로, 그 props 를
// 만드는 `Composer` 의 배선은 아무도 보지 않았다 — `selectedId` 를 `null` 로 굳혀도(N4a),
// `onSelect` 를 no-op 으로 바꿔도(N4b) 3,352 케이스가 전부 초록이었다.
//
// 여기서는 **컴포저 컨테이너를 지나** 잰다. store 상태 → Composer → 실제 트레이 마크업까지
// 한 렌더에서 보고, 콜백은 컨테이너가 건넨 것을 그대로 불러 store 액션까지 따라간다.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import type { DiffRequirementItem } from '../../../../../shared/ipc'
import { i18n } from '../../../shared/i18n'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import type { RequirementTray as RequirementTrayType } from './composer/RequirementTray'

type TrayProps = ComponentProps<typeof RequirementTrayType>

const h = vi.hoisted(() => ({
  state: null as unknown as ChatState,
  select: vi.fn(),
  remove: vi.fn(),
  tray: null as unknown
}))

vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  useChatStore: (select: (state: { activeKey: string }) => unknown) => select({ activeKey: 's' }),
  useChatBusy: () => false,
  useChatResidualSteer: () => 0,
  useNewChatPending: () => false,
  useProjectConcurrencyCount: () => 0,
  chatActions: {
    selectDiffRequirement: h.select,
    removeDiffRequirement: h.remove,
    captureDiffRequirementSnapshot: () => ({
      sessionKey: 's',
      sessionId: 's',
      ids: h.state.diffRequirements.map((item) => item.id),
      revision: 1,
      anchors: h.state.diffRequirements.map((item) => item.anchor)
    }),
    clearDiffRequirementsIfUnchanged: vi.fn(),
    send: vi.fn(),
    cancel: vi.fn(),
    answerAsk: vi.fn(),
    skipAsk: vi.fn(),
    setPermissionMode: vi.fn(),
    setModel: vi.fn(),
    setEffort: vi.fn(),
    discardSession: vi.fn(),
    startHandoff: vi.fn(),
    toggleRightPanelTile: vi.fn(),
    closeGitRow: vi.fn(),
    refreshGitSnapshot: vi.fn()
  }
}))
vi.mock('../../../shared/hooks/useAgents', () => ({ useAgents: () => [] }))
vi.mock('./composer/GitRow', () => ({ GitRow: () => null }))

// 실제 트레이를 그대로 그리면서 컨테이너가 건넨 props 도 잡는다 — 마크업 축과 콜백 축이
// 같은 렌더에서 나온다(대역으로 갈아끼우면 소비자 쪽이 안 잠긴다).
vi.mock('./composer/RequirementTray', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./composer/RequirementTray')>()
  return {
    RequirementTray: (props: TrayProps) => {
      h.tray = props
      return createElement(actual.RequirementTray, props)
    }
  }
})

import { Composer } from './Composer'

const item = (id: string): DiffRequirementItem => ({
  id,
  located: true,
  anchor: {
    sessionId: 's',
    baselineCommit: 'base',
    filePath: 'src/a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '',
    contextBefore: [],
    contextAfter: [],
    comment: `Comment ${id}`,
    createdAt: 1
  }
})

function seed(overrides: Partial<ChatState> = {}): void {
  h.state = {
    ...initialChatState,
    sessionId: 's',
    cwd: '/repo',
    diffRequirements: [item('one'), item('two')],
    ...overrides
  } as ChatState
}

/** 한 번 그리고, 그 렌더에서 컨테이너가 트레이에 건넨 props 를 함께 돌려준다. */
function renderComposer(): { $: ReturnType<typeof load>; tray: TrayProps } {
  h.tray = null
  const html = renderToStaticMarkup(
    createElement(Composer, { backendLabel: 'Claude', canAbort: true })
  )
  expect(h.tray, 'Composer 가 RequirementTray 를 그리지 않았다').not.toBeNull()
  return { $: load(html), tray: h.tray as TrayProps }
}

const chip = ($: ReturnType<typeof load>, id: string): ReturnType<ReturnType<typeof load>> =>
  $(`[data-diff-requirement-chip="${id}"]`)

beforeEach(() => {
  h.select.mockReset()
  h.remove.mockReset()
  seed()
})
afterEach(async () => {
  await i18n.changeLanguage('ko')
})

describe('컴포저 선택 표시가 컨테이너를 지난다 (D47 · VP-97 · EP-71 ②)', () => {
  it('store 의 활성 코멘트 하나만 인용 타일에서 활성으로 그려진다', () => {
    seed({ activeDiffRequirementId: 'two' })

    const { $ } = renderComposer()

    expect(chip($, 'two').find('button').first().attr('aria-pressed')).toBe('true')
    expect(chip($, 'two').attr('class')).toContain('border-selected')
    expect(chip($, 'one').find('button').first().attr('aria-pressed')).toBe('false')
    expect(chip($, 'one').attr('class')).toContain('border-transparent')
  })

  it('활성 항목을 바꾸면 활성 표시도 따라 옮겨간다 — 상수로 고정하면 갈린다', () => {
    seed({ activeDiffRequirementId: 'one' })

    const { $ } = renderComposer()

    expect(chip($, 'one').find('button').first().attr('aria-pressed')).toBe('true')
    expect(chip($, 'two').find('button').first().attr('aria-pressed')).toBe('false')
  })

  it('선택이 없으면 어느 타일도 활성이 아니다 — 양성 짝의 음성 축', () => {
    seed({ activeDiffRequirementId: null })

    const { $ } = renderComposer()

    expect($('[data-diff-requirement-chip] button[aria-pressed="true"]')).toHaveLength(0)
    expect($('[data-diff-requirement-chip] button[aria-pressed="false"]')).toHaveLength(2)
  })
})

describe('컴포저 선택 액션이 store 까지 닿는다 (D47 · VP-97 · EP-71 ②)', () => {
  it('인용 타일을 누르면 그 id 로 선택 액션이 불린다', () => {
    seed({ activeDiffRequirementId: null })

    renderComposer().tray.onSelect!('two')

    expect(h.select).toHaveBeenCalledExactlyOnceWith('two')
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('제거는 선택과 다른 액션이다 — 형제 슬롯이 맞바뀌면 갈린다', () => {
    seed({ activeDiffRequirementId: 'one' })

    renderComposer().tray.onRemove('one')

    expect(h.remove).toHaveBeenCalledExactlyOnceWith('one')
    expect(h.select).not.toHaveBeenCalled()
  })
})
