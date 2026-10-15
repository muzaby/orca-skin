import type {
  BackgroundSessionState,
  BackgroundCallRecord
} from '../../../../../../../shared/background-task'
import type { Message, ToolCall } from '../../../reducer/chatReducer'
import {
  partsToolCalls,
  subagentTasksFromMessages,
  type SubagentTaskSummary
} from '../../../lib/parts'
import { describeTool } from '../toolPresentation'

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
export function sessionPanelModel(
  messages: Message[],
  background?: BackgroundSessionState
): SessionPanelModel {
  const calls = Object.values(background?.calls ?? {})
  const latest = (id: string): BackgroundCallRecord | undefined =>
    calls.filter((call) => call.toolUseId === id).sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0]
  const agents = subagentTasksFromMessages(messages, true).map((agent) => ({
    ...agent,
    model: latest(agent.toolUseId)?.model
  }))
  const parts = messages
    .flatMap((message) => message.parts)
    .map((part) => {
      if (!('parentToolRunId' in part)) return part
      const copy = { ...part }
      delete copy.parentToolRunId
      return copy
    })
  const processes = partsToolCalls(parts)
    .filter((call) => call.name === 'Bash')
    .map((call) => {
      const observed = latest(call.toolUseId)
      const view = describeTool(call)
      const raw = call.result ? call.result.output : observed?.result
      const text = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw, null, 2)
      // Terminal control codes are presentation metadata, never executable content.
      // eslint-disable-next-line no-control-regex
      const output = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      return {
        id: call.toolUseId,
        command: view.command ?? view.subtitle,
        status: view.outcome,
        output: output.slice(-65536),
        truncated:
          output.length > 65536 ||
          (!call.result &&
            !!(
              observed?.meta &&
              typeof observed.meta === 'object' &&
              'truncated' in observed.meta &&
              observed.meta.truncated
            )),
        call
      }
    })
  return { agents, processes }
}
export type PanelView =
  | { kind: 'summary' | 'agents' | 'sources' | 'plan' | 'diff' }
  | { kind: 'agent' | 'process'; id: string }
