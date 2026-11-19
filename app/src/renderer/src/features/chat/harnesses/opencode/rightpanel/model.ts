import type { SubagentTaskSummary } from '../../../lib/parts'
import type { TaskContextDirectory, TaskContextSource } from '../../../lib/taskContext'
import type { ToolCall } from '../../../reducer/chatReducer'
import type { describeTool } from '../toolPresentation'

export interface SessionPanelModel {
  agents: (SubagentTaskSummary & { model: string | null | undefined })[]
  processes: {
    id: string
    command: string
    status: ReturnType<typeof describeTool>['outcome']
    output: string
    truncated: boolean
    call: ToolCall
  }[]
}

export function activePanelProcesses(model: SessionPanelModel): SessionPanelModel['processes'] {
  return model.processes.filter((process) => process.status === 'running')
}

export function hasPanelSources(
  directories: readonly TaskContextDirectory[],
  sources: readonly TaskContextSource[]
): boolean {
  return directories.some((directory) => !directory.working) || sources.length > 0
}
