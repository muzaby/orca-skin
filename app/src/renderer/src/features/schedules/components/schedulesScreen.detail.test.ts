// 작업 상세 — 행을 누르면 목록 아래가 아니라 우측 상세 패널(플러그인 카탈로그와 같은 셸)이 열린다.

import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
import { i18n } from '../../../shared/i18n'
import { formatDateTime, triggerSummary } from '../lib/triggerLabel'

vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useId: () => fakeHooks.useMemo(() => 'test-id', [])
  }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../shared/i18n', async (original) => {
  const source = await original<typeof import('../../../shared/i18n')>()
  return { ...source, useI18n: () => ({ tr: source.i18n.t.bind(source.i18n), locale: 'ko' }) }
})
import { SchedulesScreen, type SchedulesScreenProps } from './SchedulesScreen'

const task = (id: string, overrides: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id,
  title: `작업 ${id}`,
  projectId: 'p1',
  trigger: { kind: 'daily', at: { hour: 9, minute: 0 } },
  action: { kind: 'shell', command: `npm run ${id}` },
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
  nextRunAt: new Date(2026, 0, 6, 9, 0).getTime(),
  running: false,
  lastRun: null,
  ...overrides
})

let dom: FakeDom
let props: SchedulesScreenProps
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  dom.act(() => {})
}
const panel = (): string | null => {
  const node = dom.query('[data-schedule-detail-panel]')
  return node ? String(node.props['data-schedule-detail-panel']) : null
}
const openRow = (id: string): void => {
  const row = dom.query(`[data-schedule-row="${id}"]`)
  expect(row).not.toBeNull()
  const button = row!.querySelector('[aria-pressed]')
  expect(button).not.toBeNull()
  dom.click(button!)
}

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1400, innerHeight: 900 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  props = {
    tasks: [
      task('t1'),
      task('t2', { title: '둘째', action: { kind: 'shell', command: 'echo two' } })
    ],
    loading: false,
    revision: 0,
    projects: [{ id: 'p1', name: '카메라 검증', cwd: 'C:/work/cam' }],
    pickers: { project: () => null, execution: () => null },
    onCreate: async () => undefined,
    onUpdate: async () => undefined,
    onDelete: vi.fn(),
    onSetEnabled: vi.fn(),
    onRunNow: vi.fn(),
    loadRuns: vi.fn(async () => [
      {
        id: 7,
        taskId: 't2',
        origin: 'manual' as const,
        startedAt: 1,
        finishedAt: 2,
        status: 'success' as const,
        error: null,
        sessionId: null,
        exitCode: 0,
        output: 'two',
        outputTruncated: false
      }
    ]),
    onOpenSession: vi.fn()
  }
  dom.render(createElement(SchedulesScreen, props))
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('SchedulesScreen — 우측 상세 패널', () => {
  it('행을 누르면 그 작업의 패널이 열리고 목록 사이에는 펼침이 없다', async () => {
    expect(panel()).toBeNull()
    openRow('t2')
    await flush()
    expect(panel()).toBe('t2')
    expect(dom.query('[data-schedule-catalog]')!.props['data-state']).toBe('detail')
    // 패널 본문 — 명령과 그 작업의 실행 이력.
    expect(dom.query('[data-schedule-detail-command]')!.textContent).toBe('echo two')
    expect(props.loadRuns).toHaveBeenCalledWith('t2')
    expect(dom.query('[data-schedule-run="success"]')).not.toBeNull()
    // 목록 항목 수 = 작업 수(행 아래 펼침 영역 없음).
    expect(dom.queryAll('[data-schedule-row]')).toHaveLength(2)
    expect(dom.query('[data-schedule-history]')!.props['aria-label']).toBeDefined()
    expect(
      dom.query('[data-schedule-row="t2"]')!.querySelector('[aria-pressed]')!.props['aria-pressed']
    ).toBe(true)
  })

  it('다른 행을 누르면 패널이 그 작업으로 바뀌고 같은 행을 다시 누르면 닫힌다', async () => {
    openRow('t1')
    await flush()
    openRow('t2')
    await flush()
    expect(panel()).toBe('t2')
    openRow('t2')
    await flush()
    expect(panel()).toBeNull()
    expect(dom.query('[data-schedule-catalog]')!.props['data-state']).toBe('list')
  })

  it('닫기 버튼으로 닫힌다', async () => {
    openRow('t1')
    await flush()
    dom.click(dom.query('[data-behavior="schedule-detail:close"]')!)
    await flush()
    expect(panel()).toBeNull()
  })

  it('패널의 사용 토글은 그 작업에 적용된다', async () => {
    openRow('t2')
    await flush()
    const toggle = dom.query('[data-schedule-detail]')!.querySelectorAll('[role="switch"]')[0]
    dom.click(toggle!)
    expect(props.onSetEnabled).toHaveBeenCalledExactlyOnceWith('t2', false)
  })
})

const tr = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string
const rerender = (tasks: ScheduledTask[]): void => {
  props = { ...props, tasks }
  dom.render(createElement(SchedulesScreen, props))
}
const rowOf = (id: string): FakeNode => dom.query(`[data-schedule-row="${id}"]`)!
const detail = (): FakeNode => dom.query('[data-schedule-detail]')!
// 행·패널의 kebab 버튼을 눌러 메뉴를 펼치고 [지금 실행, 편집, 삭제] 항목을 돌려준다.
const openMenu = (scope: FakeNode): FakeNode[] => {
  dom.click(scope.querySelector('[aria-haspopup="menu"]')!)
  const items = scope.querySelectorAll('[role="menuitem"]')
  expect(items).toHaveLength(3)
  return items
}
const metaValues = (): string[] =>
  detail()
    .querySelectorAll('[title]')
    .map((node) => String(node.props.title))

// verify r1 D5 · ΔV4 AC35(EP-9) — 패널 본문과 행·패널의 조작이 그 작업을 대상으로 한다.
describe('SchedulesScreen — 패널 본문과 조작 (AC32·AC35)', () => {
  it('패널 메타는 그 작업의 트리거·프로젝트·다음 실행·명령 종류를 보인다', async () => {
    openRow('t2')
    await flush()
    const t2 = props.tasks[1]!
    expect(metaValues()).toEqual(
      expect.arrayContaining([
        triggerSummary(t2.trigger, tr as never),
        '카메라 검증',
        formatDateTime(t2.nextRunAt!, 'ko'),
        tr('schedules.kindShell')
      ])
    )
  })

  it('실행 중·일시 중지·프로젝트 삭제를 패널 메타가 구별해 보인다', async () => {
    rerender([task('t1', { running: true }), task('t2', { enabled: false, projectId: 'gone' })])
    openRow('t1')
    await flush()
    expect(metaValues()).toContain(tr('schedules.running'))
    expect(metaValues()).not.toContain(tr('schedules.paused'))
    openRow('t2')
    await flush()
    expect(metaValues()).toEqual(
      expect.arrayContaining([tr('schedules.paused'), tr('schedules.projectMissing')])
    )
  })

  it('이력의 대화 열기는 그 실행의 세션 id 로 연다', async () => {
    vi.mocked(props.loadRuns).mockResolvedValue([
      {
        id: 9,
        taskId: 't2',
        origin: 'schedule',
        startedAt: 1,
        finishedAt: 2,
        status: 'success',
        error: null,
        sessionId: 'session-5',
        exitCode: null,
        output: null,
        outputTruncated: false
      }
    ])
    openRow('t2')
    await flush()
    const run = dom.query('[data-schedule-run="success"]')!
    const open = run
      .querySelectorAll('[type="button"]')
      .find((node) => node.textContent === tr('schedules.history.openSession'))
    expect(open).toBeDefined()
    dom.click(open!)
    expect(props.onOpenSession).toHaveBeenCalledExactlyOnceWith('session-5')
  })

  it('토글은 그 작업의 사용 상태를 보이고 누르면 그 작업에 반대값을 적용한다 — 행·패널', async () => {
    rerender([task('t1'), task('t2', { enabled: false })])
    const toggleOf = (scope: FakeNode): FakeNode => scope.querySelectorAll('[role="switch"]')[0]!
    expect(toggleOf(rowOf('t1')).props['aria-checked']).toBe(true)
    expect(toggleOf(rowOf('t2')).props['aria-checked']).toBe(false)
    dom.click(toggleOf(rowOf('t2')))
    expect(props.onSetEnabled).toHaveBeenLastCalledWith('t2', true)
    openRow('t2')
    await flush()
    expect(toggleOf(detail()).props['aria-checked']).toBe(false)
    dom.click(toggleOf(detail()))
    expect(props.onSetEnabled).toHaveBeenLastCalledWith('t2', true)
    expect(props.onSetEnabled).toHaveBeenCalledTimes(2)
  })

  it('행 메뉴의 지금 실행·편집·삭제는 그 작업을 대상으로 하고, 지금 실행은 그 작업의 패널을 연다', async () => {
    expect(panel()).toBeNull()
    const [runNow] = openMenu(rowOf('t2'))
    dom.click(runNow!)
    await flush()
    expect(props.onRunNow).toHaveBeenCalledExactlyOnceWith('t2')
    expect(panel()).toBe('t2')
    const [, edit] = openMenu(rowOf('t2'))
    dom.click(edit!)
    await flush()
    expect(dom.query('[data-schedule-title]')!.props.value).toBe('둘째')
    dom.unmount()
    dom.render(createElement(SchedulesScreen, props))
    const [, , remove] = openMenu(rowOf('t2'))
    dom.click(remove!)
    expect(props.onDelete).toHaveBeenCalledExactlyOnceWith(props.tasks[1])
  })

  it('패널 메뉴의 지금 실행·편집·삭제는 패널에 연 작업을 대상으로 한다', async () => {
    openRow('t2')
    await flush()
    const [runNow] = openMenu(detail())
    dom.click(runNow!)
    expect(props.onRunNow).toHaveBeenCalledExactlyOnceWith('t2')
    const [, edit] = openMenu(detail())
    dom.click(edit!)
    await flush()
    expect(dom.query('[data-schedule-title]')!.props.value).toBe('둘째')
  })

  it('패널 메뉴의 삭제는 패널에 연 작업을 넘긴다', async () => {
    openRow('t2')
    await flush()
    const [, , remove] = openMenu(detail())
    dom.click(remove!)
    expect(props.onDelete).toHaveBeenCalledExactlyOnceWith(props.tasks[1])
  })

  it('실행 중인 작업의 지금 실행은 행·패널 모두 비활성이고 다른 작업은 활성이다', async () => {
    rerender([task('t1'), task('t2', { running: true })])
    const [rowRun] = openMenu(rowOf('t2'))
    expect(rowRun!.props.disabled).toBe(true)
    dom.click(rowRun!)
    expect(props.onRunNow).not.toHaveBeenCalled()
    const [otherRun] = openMenu(rowOf('t1'))
    expect(otherRun!.props.disabled).toBe(false)
    openRow('t2')
    await flush()
    const [panelRun] = openMenu(detail())
    expect(panelRun!.props.disabled).toBe(true)
    dom.click(panelRun!)
    expect(props.onRunNow).not.toHaveBeenCalled()
  })

  it('패널을 펼치면 목록이 inert 이고 접으면 아니다', async () => {
    openRow('t2')
    await flush()
    expect(dom.queryAll('[inert]')).toHaveLength(0)
    dom.click(dom.query('[data-behavior="schedule-detail:expand"]')!)
    await flush()
    const inert = dom.queryAll('[inert]')
    expect(inert).toHaveLength(1)
    expect(inert[0]!.querySelector('[data-schedule-row="t1"]')).not.toBeNull()
    dom.click(dom.query('[data-behavior="schedule-detail:expand"]')!)
    await flush()
    expect(dom.queryAll('[inert]')).toHaveLength(0)
  })
})
