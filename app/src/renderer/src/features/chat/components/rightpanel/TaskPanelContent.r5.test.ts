import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load, type CheerioAPI } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskTileContent } from './TaskTileContent'
import { PlanTileContent } from './PlanTileContent'
import { RightPanelTile } from './RightPanelTile'
import { ArtifactCards } from '../ArtifactCard'

const harness = vi.hoisted(() => ({ session: null as ChatState | null }))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(harness.session!),
  useChatStore: (select: (state: { activeKey: string }) => unknown) =>
    select({ activeKey: 'session' }),
  useChatBusy: () => false,
  useUnseenSettledTaskCount: () => 0,
  chatActions: { selectTask: vi.fn(), restoreComposerDraft: vi.fn() }
}))
const publications = [1, 2].map((id) => ({
  publicationId: `p${id}`,
  artifactFileId: `f${id}`,
  title: `결과 ${id}`,
  filename: `${id}.md`,
  kind: 'markdown' as const,
  sizeBytes: 10,
  publishedAt: 1
}))
const artifactState = { sessions: { session: { list: publications, files: {} } } }
vi.mock('../../store/artifactStore', () => ({
  useArtifactStore: (select: (state: typeof artifactState) => unknown) => select(artifactState),
  acquireArtifacts: vi.fn(),
  refreshArtifactList: vi.fn(),
  refreshArtifactStatuses: vi.fn()
}))
vi.mock('../../../../shared/ui/Popover', () => ({ Popover: () => null }))

beforeEach(() => {
  harness.session = {
    ...initialChatState,
    sessionId: 'session',
    agentKind: 'work',
    extraDirs: ['C:/Downloads'],
    planContent: '# 계획 문서\n\n계획에만 포함된 문장입니다.',
    messages: [
      {
        role: 'assistant',
        createdAt: 0,
        parts: [
          { type: 'tool_call', toolRunId: 'tasks', toolName: 'TaskList', args: {} },
          {
            type: 'tool_result',
            toolRunId: 'tasks',
            isError: false,
            result: 'wire',
            structuredOutput: {
              tasks: [
                {
                  id: '1',
                  subject: '가용 폭을 넘어가는 아주 긴 작업 이름을 보존합니다',
                  description: '선택된 작업의 자세한 설명',
                  status: 'in_progress',
                  blockedBy: ['3']
                },
                { id: '2', subject: '완료 작업', status: 'completed', blockedBy: [] },
                { id: '3', subject: '대기 작업', status: 'pending', blockedBy: [] }
              ]
            }
          }
        ]
      }
    ]
  }
})
const render = (kind: 'work' | 'coding'): CheerioAPI => {
  harness.session!.agentKind = kind
  return load(
    renderToStaticMarkup(createElement(kind === 'work' ? TaskTileContent : PlanTileContent))
  )
}

describe('0224 r5 actual panel composition', () => {
  it('shares task row/title/badge classes, keeps blockers, and exposes questions only in Work', () => {
    const work = render('work')
    const coding = render('coding')
    for (const selector of ['[data-task-row]', '[data-task-title]', '[data-task-status]']) {
      expect(work(selector).length).toBe(3)
      expect(
        coding(selector)
          .map((_, el) => coding(el).attr('class'))
          .get()
      ).toEqual(
        work(selector)
          .map((_, el) => work(el).attr('class'))
          .get()
      )
    }
    expect(coding('[data-task-row]').first().text()).toContain('#3 완료 필요')
    expect(work('[data-behavior="action:ask-about-task"]').length).toBe(3)
    expect(coding('[data-behavior="action:ask-about-task"]').length).toBe(0)
    expect(work('[data-task-title]').first().attr('title')).toContain('아주 긴 작업')
    expect(work('[data-task-status="in_progress"] .animate-spin').length).toBe(1)
  })
  it('hides and retains the entire Coding overview while showing a sibling full detail', () => {
    harness.session!.selectedTaskKey = 'agent:1'
    const $ = render('coding')
    const overview = $('[data-plan-task-overview]')
    const detail = $('[data-plan-task-detail]')
    expect(overview.attr('hidden')).toBeDefined()
    expect(overview.attr('inert')).toBeDefined()
    expect(overview.find('h1').text()).toBe('계획 문서')
    expect(overview.find('[data-task-row]').length).toBe(3)
    expect(detail.parent()[0]).toBe(overview.parent()[0])
    expect(detail.text()).toContain('선택된 작업의 자세한 설명')
    expect(detail.find('[data-behavior="action:back-to-plan-overview"]').length).toBe(1)
  })
  it('removes Work expansion while keeping Coding expansion and close controls', () => {
    for (const kind of ['work', 'coding'] as const) {
      harness.session!.agentKind = kind
      const tileProps = {
        id: kind === 'work' ? ('task' as const) : ('plan' as const),
        defaultLabelKey: 'chat.rightpanel.tiles.plan' as const,
        onToggleExpand: () => {},
        children: '패널 내용'
      }
      const $ = load(renderToStaticMarkup(createElement(RightPanelTile, tileProps)))
      expect($('button').length).toBe(kind === 'work' ? 0 : 2)
      expect($.text()).toContain('패널 내용')
    }
  })
  it('keeps transcript collection save but removes it from actual Work output', () => {
    const work = render('work')
    expect(work('section[aria-label="출력"] article').length).toBe(2)
    expect(work('section[aria-label="출력"]').text()).not.toContain('모두 저장')
    const html = renderToStaticMarkup(createElement(ArtifactCards, { artifacts: publications }))
    expect(html).toContain('모두 저장')
  })
})
