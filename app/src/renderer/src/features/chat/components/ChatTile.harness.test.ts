vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { createStore } = await import('zustand/vanilla')
  const bind = (init: import('zustand').StateCreator<unknown>): unknown => {
    const store = createStore(init)
    return Object.assign((select: (state: unknown) => unknown) => select(store.getState()), store)
  }
  return {
    ...actual,
    create: (init?: import('zustand').StateCreator<unknown>) => (init ? bind(init) : bind)
  }
})
import { useHarnessAvailabilityStore } from '../../../shared/stores/harnessAvailabilityStore'
import { beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { initialChatState } from '../reducer/chatReducer'
import { useScrollAnchor } from '../harnesses/claude/transcript/useScrollAnchor'

const fixture = vi.hoisted(() => ({
  backend: 'claude' as 'claude' | 'opencode',
  agentKind: 'code' as 'code' | 'work',
  inflight: false
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  default: {
    ...(await original<typeof import('react')>()),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot()
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot()
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) =>
    select({ ...initialChatState, backend: fixture.backend, agentKind: fixture.agentKind }),
  useChatStore: (select: (state: unknown) => unknown) =>
    select({ activeKey: 's', draftRestore: null }),
  useChatResponding: () => fixture.inflight,
  useChatActivity: () => ({
    foreground: 'idle',
    backgroundTaskCount: 0,
    queuedCount: 0,
    residualCount: 0,
    deliveryPendingCount: 0
  }),
  useLiveText: () => '',
  useLiveReasoning: () => '',
  usePendingSteer: () => [],
  chatActions: {}
}))
vi.mock('../harnesses/claude/transcript/useScrollAnchor', () => ({
  useScrollAnchor: vi.fn(() => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: vi.fn(),
    showJump: false,
    anchored: false
  }))
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./Composer', () => ({
  Composer: () => createElement('div', { 'data-composer-probe': '' })
}))
vi.mock('./rightpanel/RightPanel', () => ({
  RightPanel: ({
    projectName,
    projectPath
  }: {
    projectName?: string | null
    projectPath?: string | null
  }) =>
    createElement('div', {
      'data-panel-project-name': projectName,
      'data-panel-project-path': projectPath
    })
}))

import { ChatTile } from './ChatTile'

describe('harness transcript background', () => {
  it.each([
    { backend: 'claude', agentKind: 'code' },
    { backend: 'claude', agentKind: 'work' },
    { backend: 'opencode', agentKind: 'code' }
  ] as const)(
    'preserves the shared canvas, fades and transcript-only text scale for $backend/$agentKind',
    ({ backend, agentKind }) => {
      vi.clearAllMocks()
      fixture.backend = backend
      fixture.agentKind = agentKind
      const $ = load(
        renderToStaticMarkup(
          createElement(ChatTile, {
            backendLabel: backend,
            canAbort: true,
            projectName: '공유 프로젝트',
            projectPath: '/project-root'
          })
        )
      )
      expect($('[data-panel-project-path]').attr('data-panel-project-path')).toBe('/project-root')
      expect($('[data-panel-project-name]').attr('data-panel-project-name')).toBe('공유 프로젝트')
      for (const surface of ['.app-frame-pane-host', '.app-frame-tile']) {
        expect($(surface).hasClass('bg-bg')).toBe(true)
        expect($(surface).hasClass('bg-oc-background')).toBe(false)
      }
      expect($('.app-frame-transcript').hasClass('bg-bg')).toBe(backend === 'opencode')
      expect($('.app-frame-transcript').hasClass('bg-oc-background')).toBe(false)
      expect($('[class~="bg-gradient-to-b"]').hasClass('from-bg')).toBe(true)
      expect($('[class~="bg-gradient-to-t"]').hasClass('from-bg')).toBe(true)
      expect($('.app-frame-transcript').attr('data-harness')).toBe(backend)
      const textScaleClassName = '[--transcript-text-scale:var(--chat-text-scale,1)]'
      const scaleOwners = $('[class]').filter((_, element) =>
        $(element).hasClass(textScaleClassName)
      )
      expect(scaleOwners).toHaveLength(1)
      expect(scaleOwners.is('.app-frame-transcript')).toBe(true)
      const composer = $('[data-composer-probe]')
      expect(composer).toHaveLength(1)
      expect(
        composer.parents().filter((_, element) => $(element).hasClass(textScaleClassName))
      ).toHaveLength(0)
      expect(useScrollAnchor).toHaveBeenCalledTimes(backend === 'claude' ? 1 : 0)
    }
  )
})

beforeEach(() =>
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: { ...byId, opencode: { id: 'opencode', installed: true, usable: true } }
  }))
)

it('shows an unavailable notice for idle OpenCode while retaining the active turn controls until completion', () => {
  fixture.backend = 'opencode'
  fixture.agentKind = 'code'
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: {
      ...byId,
      opencode: { id: 'opencode', installed: false, usable: false, unavailableReason: 'missing' }
    }
  }))
  const render = (): ReturnType<typeof load> =>
    load(
      renderToStaticMarkup(createElement(ChatTile, { backendLabel: 'OpenCode', canAbort: true }))
    )
  fixture.inflight = true
  expect(render()('[data-composer-probe]')).toHaveLength(1)
  fixture.inflight = false
  const $ = render()
  expect($('[data-composer-probe]')).toHaveLength(0)
  expect($('textarea')).toHaveLength(0)
  expect($.text()).toContain('OpenCode가 설치되어 있지 않습니다')
  expect($('button').text()).toContain('다시 확인')
  fixture.backend = 'claude'
  expect(render()('[data-composer-probe]')).toHaveLength(1)
})
