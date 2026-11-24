import { isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import type { ScheduledRun } from '../../../../../shared/scheduled-tasks'
import { RunHistory } from './RunHistory'

vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'en' })
}))

it('keeps each bounded history row keyed by its run when a newer run is inserted', () => {
  const run = (id: number): ScheduledRun => ({
    id,
    taskId: 'task',
    origin: 'manual',
    startedAt: 1,
    finishedAt: 2,
    status: 'success',
    sessionId: null,
    exitCode: 0,
    output: null,
    outputTruncated: false,
    error: null
  })
  for (const ids of [
    [73, 51],
    [90, 73, 51]
  ]) {
    const list = RunHistory({ runs: ids.map(run), onOpenSession: vi.fn() })
    expect(list.props.children.map((row: ReactNode) => isValidElement(row) && row.key)).toEqual(
      ids.map(String)
    )
  }
})
