import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusLine } from './StatusLine'
import { PendingAssistantStatus } from './transcript/PendingAssistant'
import { useChatStore } from '../store/chatStore'
import { initialChatState } from '../reducer/chatReducer'
import type { ActivityView } from '../lib/activityLabel'

const harness = vi.hoisted(() => ({ click: undefined as undefined | (() => void) }))
vi.mock('../../../shared/ui/elapsed', async (original) => ({
  ...(await original<typeof import('../../../shared/ui/elapsed')>()),
  useElapsed: () => 283
}))
vi.mock('react/jsx-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-runtime')>()
  const capture = (type: unknown, props: Record<string, unknown>): void => {
    if (type === 'button' && props['data-behavior'] === 'action:open-background-tasks')
      harness.click = props.onClick as () => void
  }
  return {
    ...actual,
    jsx: (type: Parameters<typeof actual.jsx>[0], props: Record<string, unknown>, key?: string) => {
      capture(type, props)
      return actual.jsx(type, props, key)
    },
    jsxs: (
      type: Parameters<typeof actual.jsxs>[0],
      props: Record<string, unknown>,
      key?: string
    ) => {
      capture(type, props)
      return actual.jsxs(type, props, key)
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const [type, rawProps] = args
      const props = rawProps as Record<string, unknown>
      if (type === 'button' && props['data-behavior'] === 'action:open-background-tasks')
        harness.click = props.onClick as () => void
      return actual.jsxDEV(...args)
    }
  }
})

const activity = (patch: Partial<ActivityView> = {}): ActivityView => ({
  foreground: 'streaming',
  queuedCount: 1,
  deliveryPendingCount: 0,
  residualCount: 0,
  backgroundTaskCount: 1,
  listening: false,
  ...patch
})
const initial = useChatStore.getInitialState()
const saved = { sessions: initial.sessions, activeKey: initial.activeKey }
beforeEach(() => {
  harness.click = undefined
  vi.spyOn(Math, 'random').mockReturnValue(0.65)
})
afterEach(() => {
  Object.assign(initial, saved)
  useChatStore.setState(saved)
  vi.restoreAllMocks()
})

describe('0232 Spark background action', () => {
  it('renders status, queued input, blue hover button, then elapsed time in that order', () => {
    const html = renderToStaticMarkup(
      createElement(StatusLine, {
        turnStartedAt: 1,
        activity: activity(),
        onOpenBackground: () => undefined
      })
    )
    const button = html.match(/<button\b[^>]*>백그라운드 작업 1건<\/button>/)?.[0]
    expect(button).toBeDefined()
    expect(button).toContain('text-selected')
    expect(button).toContain('hover:bg-selected-soft')
    expect(button).toContain('focus-visible:')
    const visible = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
    expect(visible).toBe('Distilling… · 입력 대기 1건 · 백그라운드 작업 1건 (4m 43s)')
  })

  it('keeps background action visible when waiting facts overflow without losing full tooltip', () => {
    const html = renderToStaticMarkup(
      createElement(StatusLine, {
        turnStartedAt: 1,
        activity: activity({ deliveryPendingCount: 4, residualCount: 1 }),
        onOpenBackground: () => undefined
      })
    )
    expect(html).toContain('data-behavior="action:open-background-tasks"')
    expect(html).toContain('백그라운드 작업 1건</button>')
    expect(html).toContain('외 2개')
    expect(html).toContain(
      'title="전달 확인 중 3건 · 입력 대기 1건 · 중단 후 전달 대기 1건 · 백그라운드 작업 1건"'
    )
  })

  it('does not invent background actions at zero or during worktree preparation', () => {
    for (const prepareStep of [undefined, 'base'] as const) {
      const html = renderToStaticMarkup(
        createElement(StatusLine, {
          turnStartedAt: 1,
          activity: activity({ backgroundTaskCount: prepareStep ? 1 : 0 }),
          prepareStep,
          onOpenBackground: () => undefined
        })
      )
      expect(html).not.toContain('<button')
    }
  })

  it.each(['code', 'work'] as const)(
    'opens the current %s panel through the production status callback',
    (agentKind) => {
      const key = `status-${agentKind}`
      const session = {
        ...initialChatState,
        agentKind,
        sessionId: key,
        turnStartedAt: 1,
        activityForeground: 'streaming' as const,
        activityQueuedCount: 1,
        activityBackgroundTaskCount: 1,
        rightPanelTiles: []
      }
      const sessions = { [key]: { session, live: { text: '', reasoning: '' }, subagentMeta: {} } }
      Object.assign(initial, { activeKey: key, sessions })
      useChatStore.setState({ activeKey: key, sessions })
      const html = renderToStaticMarkup(createElement(PendingAssistantStatus))
      expect(html).toContain('백그라운드 작업 1건</button>')
      expect(harness.click).toBeTypeOf('function')
      harness.click!()
      const opened = useChatStore.getState().sessions[key]
      const target = agentKind === 'code' ? 'subagent' : 'task'
      expect(opened.session.rightPanelTiles.flatMap((column) => column.tiles)).toContain(target)
      expect(opened.panelReveal?.id).toBe(target)
      harness.click!()
      expect(
        useChatStore
          .getState()
          .sessions[key].session.rightPanelTiles.flatMap((column) => column.tiles)
      ).toEqual(opened.session.rightPanelTiles.flatMap((column) => column.tiles))
    }
  )
})
