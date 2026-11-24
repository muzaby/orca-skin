import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import type { ScheduledRun } from '../../../../../shared/scheduled-tasks'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { RunHistoryPanel } from './RunHistory'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))

vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))

function run(taskId: string, id: number): ScheduledRun {
  return {
    id,
    taskId,
    origin: 'manual',
    startedAt: 1,
    finishedAt: 2,
    status: 'success',
    error: null,
    sessionId: null,
    exitCode: 0,
    output: 'output-' + taskId + '-' + id,
    outputTruncated: false
  }
}

it('hides prior task results during loading and ignores a late previous revision', async () => {
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  let resolveOld!: (rows: ScheduledRun[]) => void
  let resolveNew!: (rows: ScheduledRun[]) => void
  const initial = Promise.resolve([run('old', 1)])
  const late = new Promise<ScheduledRun[]>((resolve) => {
    resolveOld = resolve
  })
  const next = new Promise<ScheduledRun[]>((resolve) => {
    resolveNew = resolve
  })
  const loadRuns = vi
    .fn()
    .mockReturnValueOnce(initial)
    .mockReturnValueOnce(late)
    .mockReturnValueOnce(next)
  const onOpenSession = (): void => {}
  const view = (taskId: string, revision: number): void => {
    dom.render(createElement(RunHistoryPanel, { taskId, revision, loadRuns, onOpenSession }))
  }
  try {
    view('old', 1)
    await initial
    view('old', 1)
    expect(dom.query('[data-schedule-run]')?.textContent).toContain('output-old-1')
    view('old', 2)
    view('new', 2)
    expect(dom.query('[data-schedule-run]')).toBeNull()
    resolveNew([run('new', 2)])
    await next
    resolveOld([run('old', 3)])
    await late
    view('new', 2)
    expect(dom.query('[data-schedule-run]')?.textContent).toContain('output-new-2')
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
  }
})
