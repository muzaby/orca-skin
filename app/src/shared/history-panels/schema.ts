import { z } from 'zod'

const text = z.string()
const key = text.min(1)
const optionalText = text.nullable()
const count = z.number().int().nonnegative()
const outcome = z.enum([
  'running',
  'completed',
  'failed',
  'aborted',
  'rejected',
  'cancelled',
  'not_executed'
])
const call = z.object({
  toolUseId: key,
  name: key,
  input: z.unknown(),
  parentToolRunId: text.optional(),
  result: z.object({ output: z.unknown(), isError: z.boolean() }).optional()
})
const task = z.object({
  key,
  id: key,
  title: text,
  subject: text,
  description: optionalText,
  status: z.enum([
    'pending',
    'in_progress',
    'completed',
    'stopping',
    'paused',
    'failed',
    'aborted',
    'rejected',
    'cancelled',
    'not_executed'
  ]),
  blockedBy: z.array(text)
})
const agent = z.object({
  toolUseId: key,
  description: text,
  status: outcome,
  createdAtMs: z.number(),
  childToolCount: count,
  durationMs: z.number().nullable(),
  tokenCount: z.number().nullable(),
  agentLabel: optionalText,
  subagentType: optionalText,
  currentChildLabel: optionalText,
  settlementMessage: optionalText,
  asyncLaunched: z.boolean(),
  call,
  model: optionalText.optional()
})
const source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('web'), url: key, title: text }),
  z.object({ kind: z.literal('file'), path: key }),
  z.object({
    kind: z.literal('attachment'),
    attachmentId: key,
    name: text,
    image: z.boolean(),
    path: key.optional()
  })
])
export const PanelItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tasks'), item: task, activeForm: text.optional() }),
  z.object({
    kind: z.literal('agents'),
    item: agent,
    child: z
      .object({
        id: key,
        role: z.literal('assistant'),
        createdAt: z.number(),
        parts: z.array(z.object({ type: key }))
      })
      .nullable()
      .optional()
  }),
  z.object({
    kind: z.literal('processes'),
    item: z.object({
      id: key,
      command: text,
      status: outcome,
      output: text,
      truncated: z.boolean(),
      call
    }),
    outputLength: count
  }),
  z.object({ kind: z.literal('sources'), item: source })
])
