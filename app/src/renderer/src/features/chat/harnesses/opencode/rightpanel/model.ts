import type { TaskContextDirectory, TaskContextSource } from '../../../lib/taskContext'
import type { SessionPanelModel } from '../../../../../../../shared/history-panels/types'
export type { SessionPanelModel } from '../../../../../../../shared/history-panels/types'

export function activePanelProcesses(model: SessionPanelModel): SessionPanelModel['processes'] {
  return model.processes.filter((process) => process.status === 'running')
}

export function hasPanelSources(
  directories: readonly TaskContextDirectory[],
  sources: readonly TaskContextSource[]
): boolean {
  return directories.some((directory) => !directory.working) || sources.length > 0
}
