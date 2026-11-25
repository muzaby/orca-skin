import { isRecord } from '../obj'
import type { LoadedMessage } from '../ipc'
import { directoryIdentity } from '../extra-directories'
import { processOutputText, type TranscriptPanelProjection } from './projection'
import type { SubagentTaskSummary } from './tool'
import type { SessionPanelModel, TaskBoardItem, TaskContextSource, ToolCall } from './types'

export const panelKinds = ['tasks', 'agents', 'processes', 'sources'] as const
export type PanelKind = (typeof panelKinds)[number]
type Agent = SessionPanelModel['agents'][number]
type Process = SessionPanelModel['processes'][number]

export type PanelItem =
  | { kind: 'tasks'; item: TaskBoardItem; activeForm?: string }
  | { kind: 'agents'; item: Agent; child?: LoadedMessage | null }
  | { kind: 'processes'; item: Process; outputLength: number }
  | { kind: 'sources'; item: TaskContextSource }

export function sourceKey(item: TaskContextSource): string {
  if (item.kind === 'web') return 'web:' + item.url
  if (item.path) return 'file:' + directoryIdentity(item.path)
  return 'attachment:' + (item.kind === 'attachment' ? item.attachmentId : '')
}

function summaryCall(call: ToolCall): ToolCall {
  const input = isRecord(call.input) ? call.input : {}
  const out = isRecord(call.result?.output) ? call.result.output : {}
  const pick = (record: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
    Object.fromEntries(
      keys
        .filter((k) => typeof record[k] === 'string' || typeof record[k] === 'number')
        .map((k) => [k, record[k]])
    )
  return {
    toolUseId: call.toolUseId,
    name: call.name,
    input: pick(input, ['description', 'agentLabel', 'subagent_type', 'command']),
    ...(call.parentToolRunId !== undefined ? { parentToolRunId: call.parentToolRunId } : {}),
    ...(call.result
      ? {
          result: {
            output: pick(out, [
              'reason',
              'message',
              'cause',
              'status',
              'agentLabel',
              'tokens',
              'tokenCount'
            ]),
            isError: call.result.isError,
            subagentMeta: call.result.subagentMeta,
            nonExecution: call.result.nonExecution,
            durationMs: call.result.durationMs
          }
        }
      : {})
  }
}

function agentSummary(agent: SubagentTaskSummary): Agent {
  return { ...agent, model: agent.call.result?.subagentMeta?.model, call: summaryCall(agent.call) }
}

export function* panelRows(index: TranscriptPanelProjection): Generator<{
  key: string
  summary: PanelItem
  detail?: PanelItem
}> {
  for (const item of index.taskBoard())
    yield {
      key: item.key,
      summary: {
        kind: 'tasks',
        item: { ...item, description: null },
        activeForm: index.taskSeedFor(item.id)?.activeForm
      },
      detail: { kind: 'tasks', item, activeForm: index.taskSeedFor(item.id)?.activeForm }
    }
  const model = index.openCodePanelModel()
  for (const item of model.agents)
    yield {
      key: item.toolUseId,
      summary: { kind: 'agents', item: agentSummary(item) },
      detail: { kind: 'agents', item, child: index.childMessage(item.toolUseId) }
    }
  for (const item of model.processes) {
    const outputLength = item.truncated
      ? processOutputText(item.call.result?.output).length
      : item.output.length
    yield {
      key: item.id,
      summary: {
        kind: 'processes',
        item: { ...item, output: '', call: summaryCall(item.call) },
        outputLength
      },
      detail: { kind: 'processes', item, outputLength }
    }
  }
  for (const item of index.taskContextSources())
    yield { key: sourceKey(item), summary: { kind: 'sources', item } }
}
