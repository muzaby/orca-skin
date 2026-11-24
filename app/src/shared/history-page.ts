import { z } from 'zod'
import { AGENT_KINDS } from './agent-kind'
import type { LoadedSession } from './ipc'

export const HISTORY_PAGE_BYTES = 256 * 1024
export const HISTORY_PAGE_MESSAGES = 128
export const HISTORY_PAGE_PARTS = 256
export const HISTORY_BODY_BYTES = 64 * 1024

const key = z.string().min(1).max(4096)
const request = z.object({
  sessionId: key,
  requestId: z.number().int().nonnegative(),
  openGeneration: z.number().int().nonnegative()
})
export const HistoryLocatorSchema = z.object({
  v: z.literal(1),
  session: key,
  source: z.enum(['local', 'archive', 'native']),
  identity: key,
  epoch: key,
  projectedKey: key.optional()
})
export type HistoryLocator = z.infer<typeof HistoryLocatorSchema>
export const HistoryBodyRefSchema = z.object({
  kind: z.literal('parts'),
  session: key,
  generation: key,
  message: key,
  bytes: z.number().int().positive()
})
export type HistoryBodyRef = z.infer<typeof HistoryBodyRefSchema>
export const HistoryPageRequestSchema = z.discriminatedUnion('kind', [
  request.extend({ kind: z.literal('latest') }),
  request.extend({ kind: z.literal('earlierTurn'), cursor: key }),
  request.extend({ kind: z.literal('laterTurn'), cursor: key }),
  request.extend({
    kind: z.literal('withinTurn'),
    direction: z.enum(['before', 'after']),
    cursor: key
  }),
  request.extend({
    kind: z.literal('body'),
    ref: HistoryBodyRefSchema,
    offset: z.number().int().nonnegative()
  }),
  request.extend({
    kind: z.literal('target'),
    locator: HistoryLocatorSchema,
    cached: z.object({ generation: key, messageKey: key }).optional()
  })
])
export type HistoryPageRequest = z.infer<typeof HistoryPageRequestSchema>
export type HistoryQuery = HistoryPageRequest extends infer R
  ? R extends HistoryPageRequest
    ? Omit<R, 'requestId'>
    : never
  : never
export type HistoryEdge = { kind: 'earlierTurn' | 'laterTurn' | 'withinTurn'; cursor: string }
const edgeSchema = z.object({
  kind: z.enum(['earlierTurn', 'laterTurn', 'withinTurn']),
  cursor: key
})
const windowSchema = z.object({
  generation: key,
  before: edgeSchema.optional(),
  after: edgeSchema.optional()
})
const part = z.object({ type: z.string().min(1) })
const message = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  createdAt: z.number(),
  parts: z.array(part).max(HISTORY_PAGE_PARTS),
  deferredBody: HistoryBodyRefSchema.optional()
})
export const HistoryPageReplySchema = z.discriminatedUnion('status', [
  request.extend({
    status: z.literal('ok'),
    session: z.object({
      id: key,
      backend: z.enum(['claude', 'opencode']),
      agentKind: z.enum(AGENT_KINDS),
      title: z.string().nullable(),
      complete: z.literal(false),
      messages: z.array(message).max(HISTORY_PAGE_MESSAGES),
      history: windowSchema
    })
  }),
  request.extend({ status: z.literal('useCached'), generation: key, messageKey: key }),
  request.extend({
    status: z.literal('body'),
    offset: z.number().int().nonnegative(),
    nextOffset: z.number().int().positive(),
    done: z.boolean(),
    base64: z
      .string()
      .min(1)
      .max(Math.ceil(HISTORY_BODY_BYTES / 3) * 4)
  }),
  request.extend({ status: z.enum(['missing', 'stale', 'invalid', 'unavailable', 'cancelled']) })
])

export interface HistoryWindow {
  generation: string
  before?: HistoryEdge
  after?: HistoryEdge
}
export interface HistoryPrepared {
  queuedMs: number
  buildMs: number
  sourceBytes: number
}
export type HistoryPageReply = Pick<
  HistoryPageRequest,
  'sessionId' | 'requestId' | 'openGeneration'
> &
  (
    | {
        status: 'ok'
        session: LoadedSession & { history: HistoryWindow }
        targetMessage?: string
        prepared?: HistoryPrepared
      }
    | { status: 'useCached'; generation: string; messageKey: string }
    | { status: 'body'; base64: string; offset: number; nextOffset: number; done: boolean }
    | { status: 'missing' | 'stale' | 'invalid' | 'unavailable' | 'cancelled' }
  )
