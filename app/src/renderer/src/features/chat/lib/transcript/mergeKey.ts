import type { AppMessagePart } from '../../../../../../shared/ipc'

export function partMergeKey(part: AppMessagePart): string | undefined {
  switch (part.type) {
    case 'error':
      return part.failure && `failure:${part.failure.failureId}`
    case 'tool_result':
      return `result:${part.toolRunId}`
    case 'response_boundary':
      return `boundary:${part.boundary.phase}:${part.boundary.id}`
    case 'artifact':
      return `artifact:${part.artifact.publicationId}`
  }
  return undefined
}
