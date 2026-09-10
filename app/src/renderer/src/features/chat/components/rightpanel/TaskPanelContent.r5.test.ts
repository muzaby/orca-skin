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
const render = (kind: 'work' | 'code'): CheerioAPI => {
  harness.session!.agentKind = kind
  return load(
    renderToStaticMarkup(createElement(kind === 'work' ? TaskTileContent : PlanTileContent))
  )
}

describe('0224 r5 actual panel composition', () => {
  it('shares task row/title/badge classes, keeps blockers, and exposes questions only in Work', () => {
    const work = render('work')
    const code = render('code')
    for (const selector of ['[data-task-row]', '[data-task-title]', '[data-task-status]']) {
      expect(work(selector).length).toBe(3)
      expect(
        code(selector)
          .map((_, el) => code(el).attr('class'))
          .get()
      ).toEqual(
        work(selector)
          .map((_, el) => work(el).attr('class'))
          .get()
      )
    }
    expect(code('[data-task-row]').first().text()).toContain('#3 완료 필요')
    expect(work('[data-behavior="action:ask-about-task"]').length).toBe(3)
    expect(code('[data-behavior="action:ask-about-task"]').length).toBe(0)
    expect(work('[data-task-title]').first().attr('title')).toContain('아주 긴 작업')
    expect(work('[data-task-status="in_progress"] .animate-spin').length).toBe(1)
  })
  it('hides and retains the entire Code overview while showing a sibling full detail', () => {
    harness.session!.selectedTaskKey = 'agent:1'
    const $ = render('code')
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
  it('removes Work expansion while keeping Code expansion and close controls', () => {
    for (const kind of ['work', 'code'] as const) {
      harness.session!.agentKind = kind
      const tileProps = {
        id: kind === 'work' ? ('task' as const) : ('plan' as const),
        defaultLabelKey: 'chat.rightpanel.tiles.plan' as const,
        onToggleExpand: () => {},
        taskTileChrome: kind === 'work' ? ('work-overview' as const) : ('standard' as const),
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
  it('shows confirmed session schedules above Work progress with the supplied cron and recurrence', () => {
    harness.session!.sessionSchedules = [
      { id: 'cron-1', schedule: '*/5 * * * *', recurring: true, prompt: '서버 상태 확인' },
      { id: 'cron-2', schedule: '0 9 10 9 *', recurring: false, prompt: '한 번만 확인 <이름>' }
    ]
    const work = render('work')
    expect(work('[data-task-section]').first().attr('data-task-section')).toBe('scheduled')
    expect(work('[data-session-schedule]').length).toBe(2)
    expect(work('[data-session-schedule="cron-1"]').text()).toContain('서버 상태 확인')
    expect(work('[data-session-schedule="cron-1"]').text()).toContain('*/5 * * * *')
    expect(work('[data-session-schedule="cron-1"]').text()).toContain('반복')
    expect(work('[data-session-schedule="cron-2"]').text()).toContain('한 번')
    expect(work('[data-task-section="scheduled"]').text()).toContain(
      '실행 시각은 달라질 수 있습니다.'
    )
    expect(render('code')('[data-session-schedule]').length).toBe(0)
  })
  it('does not invent a scheduled section before a snapshot or after its jobs are removed', () => {
    expect(render('work')('[data-task-section="scheduled"]').length).toBe(0)
    harness.session!.sessionSchedules = []
    expect(render('work')('[data-task-section="scheduled"]').length).toBe(0)
    expect(render('work')('[data-task-section="progress"]').length).toBe(1)
  })
  it('shows an acknowledged wakeup before a schedule ID is known without an invented count or deadline', () => {
    harness.session!.sessionSchedules = []
    harness.session!.pendingSessionWakeup = true
    const work = render('work')
    const section = work('[data-task-section="scheduled"]')
    expect(section.length).toBe(1)
    expect(section.find('button').text().trim()).toBe('예정')
    expect(section.text()).toContain('반복 작업 대기 중')
    expect(section.text()).toContain('예약 정보를 기다리는 중')
    expect(work('[data-session-schedule]').length).toBe(0)
    expect(work('[data-session-wakeup-pending]').length).toBe(1)
    expect(section.text()).not.toContain('마지막으로 확인한 예약 목록')
    harness.session!.sessionSchedules = [
      { id: 'known', schedule: '*/5 * * * *', recurring: true, prompt: '확인된 예약' }
    ]
    const withKnown = render('work')
    expect(withKnown('[data-session-schedule]').length).toBe(1)
    expect(withKnown('[data-session-wakeup-pending]').length).toBe(0)
    expect(withKnown('[data-task-section="scheduled"]').text()).toContain(
      '마지막으로 확인한 예약 목록입니다.'
    )
  })
})
