import { PanelItemSchema } from '../../../../../shared/history-panels/schema'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { HistoryQuery, HistoryPageReply } from '../../../../../shared/history-page'
import {
  panelKinds,
  type PanelKind,
  type PanelItem,
  sourceKey
} from '../../../../../shared/history-panels/rows'
import {
  agentModelFromCall,
  deriveSubagentTaskStatus,
  settlementMessageFromCall,
  tokenCountFromResult,
  isAsyncLaunchedResult,
  toolRunOutcome
} from '../../../../../shared/history-panels/tool'
import {
  processOutputText,
  TranscriptPanelProjection,
  type TranscriptIndex,
  type TaskFoldEntry
} from '../../../../../shared/history-panels/projection'
import type { LoadedMessage } from '../../../../../shared/ipc'
import type { BackgroundSessionState } from '../../../../../shared/background-task'
import type { SessionPanelModel, ToolCall } from '../../../../../shared/history-panels/types'
import { sessionApi } from '../../../shared/api/ipc'

export interface PanelScope {
  sessionId: string
  generation: string
  openGeneration: number
}
type Row = { key: string; value: PanelItem }
type Page = {
  frontier?: { key: string; parts: number }
  rows: Row[]
  state: 'initial' | 'pending' | 'ready' | 'failed'
  next?: string
  checkpoint?: number
  total?: number
}
const blank = (): Page => ({ rows: [], state: 'initial' })
type Pages = Record<PanelKind, Page>
const initial = (): Pages => ({
  tasks: blank(),
  agents: blank(),
  sources: blank(),
  processes: blank()
})
type Query = (query: HistoryQuery) => Promise<HistoryPageReply>

export class SessionPanels {
  private pages: Pages = initial()
  private listeners = new Set<() => void>()
  private pendingDetails = new Map<string, Promise<void>>()
  private revision = 0
  constructor(
    private scope: PanelScope,
    private query: Query
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = (): Pages => this.pages
  private set(kind: PanelKind, page: Page): void {
    this.pages = { ...this.pages, [kind]: page }
    for (const listener of this.listeners) listener()
  }
  async read(kind: PanelKind, more = false): Promise<void> {
    const prior = this.pages[kind]
    if (prior.state === 'pending' || (prior.state === 'ready' && (!more || !prior.next))) return
    const version = this.revision
    this.set(kind, { ...prior, state: 'pending' })
    try {
      const result = await this.query({
        ...this.scope,
        kind: 'panelSummary',
        panel: kind,
        cursor: prior.next
      })
      if (version !== this.revision) return
      if (result.status === 'stale' && prior.next) {
        this.set(kind, blank())
        return this.read(kind)
      }
      if (result.status !== 'panelSummary') throw Error(result.status)
      this.set(kind, {
        state: 'ready',
        rows: prior.next ? [...prior.rows, ...result.rows] : result.rows,
        next: result.next,
        total: result.total,
        checkpoint: result.checkpoint,
        frontier: result.frontier
      })
    } catch {
      if (version === this.revision) this.set(kind, { ...prior, state: 'failed' })
    }
  }
  detail(kind: PanelKind, key: string): Promise<void> | undefined {
    const page = this.pages[kind]
    if (page.checkpoint === undefined || !page.rows.some((r) => r.key === key)) return
    const id = JSON.stringify([kind, key, page.checkpoint])
    const pending = this.pendingDetails.get(id)
    if (pending) return pending
    const version = this.revision
    const read = async (): Promise<void> => {
      const chunks: Uint8Array[] = []
      let offset = 0
      try {
        for (;;) {
          const reply = await this.query({
            ...this.scope,
            kind: 'panelDetail',
            panel: kind,
            itemKey: key,
            checkpoint: page.checkpoint!,
            offset
          })
          if (this.revision !== version || this.pages[kind].checkpoint !== page.checkpoint) return
          if (reply.status === 'stale') {
            this.set(kind, blank())
            await this.read(kind)
            return
          }
          if (reply.status !== 'panelDetail') throw Error(reply.status)
          const bytes = Uint8Array.from(atob(reply.base64), (c) => c.charCodeAt(0))
          if (bytes.length + offset !== reply.nextOffset) throw Error('Invalid panel detail chunk')
          chunks.push(bytes)
          offset = reply.nextOffset
          if (reply.done) break
        }
        const bytes = new Uint8Array(offset)
        let at = 0
        for (const chunk of chunks) {
          bytes.set(chunk, at)
          at += chunk.length
        }
        const value: PanelItem = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!PanelItemSchema.safeParse(value).success || value.kind !== kind)
          throw Error('Unexpected panel detail')
        const current = this.pages[kind]
        this.set(kind, {
          ...current,
          rows: current.rows.map((r) => (r.key === key ? { key, value } : r))
        })
      } catch {
        if (this.revision === version) {
          this.pendingDetails.delete(id)
          this.set(kind, { ...this.pages[kind], state: 'failed' })
        }
      }
    }
    const request = read()
    this.pendingDetails.set(id, request)
    return request
  }
  invalidate(): void {
    this.revision++
    this.pendingDetails.clear()
    this.pages = initial()
    for (const listener of this.listeners) listener()
  }
}

const byScope = new Map<string, SessionPanels>()
const consumers = new Map<SessionPanels, number>()
function retain(key: string, store: SessionPanels): () => void {
  byScope.set(key, store)
  consumers.set(store, (consumers.get(store) ?? 0) + 1)
  return () => {
    const remaining = (consumers.get(store) ?? 1) - 1
    if (remaining) consumers.set(store, remaining)
    else {
      consumers.delete(store)
      if (byScope.get(key) === store) byScope.delete(key)
      store.invalidate()
    }
  }
}
const empty = initial()
const noSubscribe = (): (() => void) => () => {}
const emptySnapshot = (): Pages => empty
export function usePanelPages(
  scope: PanelScope | undefined,
  kinds: readonly PanelKind[],
  chosen?: { kind: PanelKind; key: string }
): { pages: Pages; store?: SessionPanels } {
  const resource = useMemo(() => {
    if (!scope) return
    const key = JSON.stringify([scope.sessionId, scope.generation, scope.openGeneration])
    const store = byScope.get(key) ?? new SessionPanels(scope, (req) => sessionApi.page(req))
    byScope.set(key, store)
    return { key, store }
  }, [scope])
  const store = resource?.store
  const pages = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    store?.snapshot ?? emptySnapshot,
    emptySnapshot
  )
  useEffect(() => {
    if (!resource) return
    return retain(resource.key, resource.store)
  }, [resource])
  const selected = kinds.join(',')
  useEffect(() => {
    if (store)
      for (const kind of panelKinds)
        if (selected.split(',').includes(kind) && pages[kind].state === 'initial')
          void store.read(kind)
  }, [store, selected, pages])
  const chosenKind = chosen?.kind,
    chosenKey = chosen?.key
  useEffect(() => {
    if (store && chosenKind && chosenKey && pages[chosenKind].state === 'ready')
      void store.detail(chosenKind, chosenKey)
  }, [store, chosenKind, chosenKey, pages])
  return { pages, store }
}

export function domainPanels(domain: string): PanelKind[] {
  switch (domain) {
    case 'taskBoard':
      return ['tasks']
    case 'taskContextSources':
      return ['sources']
    case 'sessionPanelModel':
      return ['agents', 'processes']
    default:
      return ['agents']
  }
}

export function mergePanelView(
  domain: string,
  arg: unknown,
  pages: Pages,
  live: TranscriptIndex,
  liveMessages: readonly LoadedMessage[]
): unknown {
  const frontier = pages[domainPanels(domain)[0]].frontier
  const at = frontier ? liveMessages.findIndex((m) => m.id === frontier.key) : -1
  if (at >= 0 && frontier) {
    const last = liveMessages[at]
    const tail = liveMessages.slice(at + 1)
    if (last.parts.length > frontier.parts)
      tail.unshift({ ...last, parts: last.parts.slice(frontier.parts) })
    liveMessages = tail
    const delta = new TranscriptPanelProjection()
    delta.reset(tail)
    live = delta
  }
  const agents = new Map(
    pages.agents.rows.flatMap(({ key, value }) =>
      value.kind === 'agents' ? [[key, value.item] as const] : []
    )
  )
  const results = live.transcriptResults()
  for (const [key, agent] of agents) {
    const result = results.get(key)
    if (!result) continue
    const call = { ...agent.call, result }
    agents.set(key, {
      ...agent,
      call,
      status: deriveSubagentTaskStatus(call),
      model: result.subagentMeta?.model ?? agent.model,
      childToolCount: result.subagentMeta?.toolUses ?? agent.childToolCount,
      durationMs: result.subagentMeta?.durationMs ?? result.durationMs ?? agent.durationMs,
      agentLabel: agentModelFromCall(call),
      settlementMessage: settlementMessageFromCall(call),
      tokenCount: tokenCountFromResult(result.output),
      asyncLaunched: isAsyncLaunchedResult(result)
    })
  }
  for (const agent of live.subagentTasks(true))
    agents.set(agent.toolUseId, { ...agent, model: agent.call.result?.subagentMeta?.model })
  switch (domain) {
    case 'taskBoard': {
      const board = pages.tasks.rows.flatMap(({ value }) =>
        value.kind === 'tasks' ? [value.item] : []
      )
      if (!liveMessages.length) return board
      const seeds: TaskFoldEntry[] = pages.tasks.rows.flatMap(({ value }) => {
        if (value.kind !== 'tasks') return []
        const { id, subject, description, status, blockedBy } = value.item
        if (status !== 'in_progress' && status !== 'pending' && status !== 'completed') return []
        return [
          {
            id,
            subject,
            description: description ?? undefined,
            status,
            blockedBy,
            activeForm: value.activeForm
          }
        ]
      })
      const fold = new TranscriptPanelProjection(seeds)
      fold.reset(liveMessages)
      return fold.taskBoard()
    }
    case 'taskContextSources': {
      const items = new Map(
        pages.sources.rows.flatMap(({ key, value }) =>
          value.kind === 'sources' ? [[key, value.item] as const] : []
        )
      )
      for (const source of live.taskContextSources()) items.set(sourceKey(source), source)
      return [...items.values()]
    }
    case 'subagentTasks':
      return [...agents.values()].filter((a) => arg || a.call.parentToolRunId === undefined)
    case 'subagentTaskDescription':
      return agents.get(String(arg))?.description
    case 'childMessage': {
      const saved = pages.agents.rows.find((r) => r.key === arg)?.value
      const prior = saved?.kind === 'agents' ? saved.child : null
      const child = live.childMessage(String(arg))
      return prior && child
        ? { ...prior, parts: [...prior.parts, ...child.parts] }
        : (child ?? prior ?? null)
    }
    case 'persistedBackgroundModels':
      return new Map(
        [...agents.values()].flatMap((a) =>
          a.call.result?.subagentMeta?.model
            ? [[a.toolUseId, a.call.result.subagentMeta.model]]
            : []
        )
      )
    case 'transcriptResults': {
      const results = new Map<string, NonNullable<ToolCall['result']>>()
      for (const a of agents.values()) if (a.call.result) results.set(a.toolUseId, a.call.result)
      for (const [id, result] of live.transcriptResults()) results.set(id, result)
      return results
    }
    case 'sessionPanelModel': {
      const bg = arg as BackgroundSessionState | undefined
      const active = live.openCodePanelModel(bg)
      const processes = new Map(
        pages.processes.rows.flatMap(({ key, value }) =>
          value.kind === 'processes' ? [[key, value.item] as const] : []
        )
      )
      for (const [id, process] of processes) {
        const result = results.get(id)
        if (!result) continue
        const output = processOutputText(result.output)
        processes.set(id, {
          ...process,
          call: { ...process.call, result },
          output: output.slice(-65536),
          truncated: output.length > 65536,
          status: toolRunOutcome(result)
        })
      }
      for (const p of active.processes) processes.set(p.id, p)
      const models = new Map<string, { model?: string | null; lastSeenAt: number }>()
      for (const call of Object.values(bg?.calls ?? {}))
        if (!models.has(call.toolUseId) || models.get(call.toolUseId)!.lastSeenAt < call.lastSeenAt)
          models.set(call.toolUseId, call)
      return {
        agents: [...agents.values()].map((a) => ({
          ...a,
          model: models.get(a.toolUseId)?.model ?? a.model
        })),
        processes: [...processes.values()]
      } satisfies SessionPanelModel
    }
  }
  return undefined
}
