import type { Event, OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { PermissionAction } from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import type { TurnRequest } from '../../common/turn'
import { normalizeOpenCodeTool } from './map'

export async function replyToApproval(
  client: OpencodeClient,
  event: Extract<Event, { type: 'permission.asked' | 'question.asked' }>,
  req: TurnRequest,
  signal: AbortSignal
): Promise<void> {
  const p = event.properties
  const action: PermissionAction =
    event.type === 'permission.asked'
      ? {
          kind: 'tool_approval',
          toolName: normalizeOpenCodeTool(event.properties.permission, {}).name,
          input: { patterns: event.properties.patterns, ...event.properties.metadata }
        }
      : {
          kind: 'ask_question',
          request: {
            requestId: p.id,
            questions: event.properties.questions.map((question) => ({
              header: question.header,
              question: question.question,
              multiSelect: question.multiple ?? false,
              options: question.options.map((option) => ({
                label: option.label,
                description: option.description
              }))
            }))
          }
        }
  const resolution = (await req.requestApproval?.(action, signal)) ?? { behavior: 'deny' as const }
  signal.throwIfAborted()
  if (event.type === 'permission.asked') {
    await client.permission.reply(
      {
        requestID: p.id,
        directory: req.cwd,
        reply:
          resolution.behavior === 'allow'
            ? resolution.updatedPermissions?.length
              ? 'always'
              : 'once'
            : 'reject'
      },
      { signal, throwOnError: true }
    )
  } else if (resolution.behavior === 'deny') {
    await client.question.reject(
      { requestID: p.id, directory: req.cwd },
      { signal, throwOnError: true }
    )
  } else {
    const input = isRecord(resolution.updatedInput) ? resolution.updatedInput : {}
    const answers = isRecord(input.answers) ? input.answers : {}
    await client.question.reply(
      {
        requestID: p.id,
        directory: req.cwd,
        answers: event.properties.questions.map((question) => {
          const answer = answers[question.question]
          return Array.isArray(answer)
            ? answer.filter((x): x is string => typeof x === 'string')
            : typeof answer === 'string'
              ? [answer]
              : []
        })
      },
      { signal, throwOnError: true }
    )
  }
}
