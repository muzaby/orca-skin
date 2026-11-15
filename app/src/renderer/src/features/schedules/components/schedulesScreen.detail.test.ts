// 작업 상세 — 행을 누르면 목록 아래가 아니라 우측 상세 패널(플러그인 카탈로그와 같은 셸)이 열린다.

import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'

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
