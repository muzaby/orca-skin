import { createElement } from 'react'
import { it, vi } from 'vitest'
import { expectVirtualKeys } from '../../../shared/ui/virtual/rowKeys.testfixture'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'

import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { SchedulesScreen } from './SchedulesScreen'

it('uses each scheduled task ID for virtual measurement', () => {
  const tasks: ScheduledTask[] = Array.from({ length: CATALOG_VIRTUALIZE_AFTER + 1 }, (_, i) => ({
    id: 'task-' + (100 - i),
    projectId: 'project',
    title: 'Task',
    trigger: { kind: 'hourly' },
    action: { kind: 'shell', command: 'pwd' },
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    nextRunAt: null,
    running: false,
    lastRun: null
  }))
  expectVirtualKeys(
    createElement(SchedulesScreen, {
      tasks,
      loading: false,
      projects: [],
      revision: 0,
      pickers: { project: () => null, execution: () => null },
      onCreate: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      onRunNow: vi.fn(),
      onSetEnabled: vi.fn(),
      loadRuns: vi.fn(),
      onOpenSession: vi.fn()
    }),
    tasks.map((task) => task.id)
  )
})
