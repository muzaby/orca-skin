import { copyForkDisplay } from '../../features/history/fork-display'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 저장기 → infra/ipc/send → electron 런타임 체인을 끊는다 — 이 스위트는 electron 바이너리 없이 돈다.

import type { BackgroundEvent } from '../../../shared/background-task'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import { resolveAgentProfile } from '../../features/agents/profiles'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { HistoryWriter } from '../../features/history/writer'
import { materializeContinuityArrival } from '../../features/orchestration/fork'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { createPeerLink } from '../../infra/ipc/peer-link'
import { createPeerLoopback } from '../../infra/ipc/peer-loopback.testfixture'
import * as stall from '../../infra/perf/stall-monitor'
import { createPersistenceSender } from '../agent-host/persistence-sender'
import { createPersistenceReceiver } from './persistence-receiver'

type AgentTurn = TurnContext<ClientRef>
type Usage = { recordTurnUsage: (turn: TurnContext, ev: NormalizedEvent) => void }

const connections: Database.Database[] = []

function openDb(): { db: DbQueries; raw: Database.Database } {
  const raw = new Database(':memory:')
  connections.push(raw)
  applyMigrations(raw)
  return { db: new DbQueries(raw), raw }
}

// 사용자 표 전부 — 검색 색인의 그림자 표와 마이그레이션 메타는 뺀다.
function dump(raw: Database.Database): Record<string, unknown[]> {
  const tables = raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' AND name <> '_migrations' ORDER BY name"
    )
    .all() as Array<{ name: string }>
  return Object.fromEntries(
    tables.map(({ name }) => {
      const primary = raw.pragma(`table_info("${name}")`) as Array<{ name: string; pk: number }>
      const columns = primary
        .filter((column) => column.pk)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => '"' + column.name.replaceAll('"', '""') + '"')
      const order = columns.length ? columns.join(',') : 'rowid'
      return [name, raw.prepare(`SELECT * FROM "${name}" ORDER BY ${order}`).all()]
    })
  )
}

function writerFor(db: DbQueries): HistoryWriter {
  return new HistoryWriter(
    db,
    (kind) => resolveAgentProfile(kind).persistResponseBoundaries,
    (arrival) => materializeContinuityArrival(db, arrival, copyForkDisplay),
    db.artifacts
  )
}

function agentTurn(overrides: Partial<Record<string, unknown>> = {}): AgentTurn {
  return {
    owner: { id: 1 },
    controller: new AbortController(),
    titleAdapter: { id: 'opencode' },
    agentKind: 'code',
    providerKey: 'provider-x',
    isNewSession: true,
    pendingUserText: 'first words',
    pendingProjectId: null,
    dbSessionId: null,
    currentAssistantMessageId: null,
    assistantText: '',
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    ...overrides
  } as unknown as AgentTurn
}

// 한 입력 열을 두 경로가 같은 모양으로 받는다.
interface Driver {
  turn: AgentTurn
  event(ev: NormalizedEvent): void
  ask(): void
  commit(text: string): Promise<number | null>
  end(): void
  provider(event: BackgroundEvent, committed: () => void): void
  forget(sessionId: string): void
  settle(): Promise<void>
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

function withoutMessageKeys(snapshot: Record<string, unknown[]>): Record<string, unknown[]> {
  // The legacy direct writer did not have an agent-side key allocator.
  const messages = snapshot.messages as Array<Record<string, unknown>>
  return { ...snapshot, messages: messages.map((message) => ({ ...message, message_key: null })) }
}

// 지금의 한 프로세스 경로 — 저장기를 직접 부른다.
function direct(db: DbQueries, usage: Usage, turn = agentTurn()): Driver {
  const writer = writerFor(db)
  return {
    turn,
    event(ev) {
      if (ev.type === 'telemetry') usage.recordTurnUsage(turn, ev)
      writer.persist(turn, ev)
    },
    ask() {
      const answers = turn.pendingAskAnswers.splice(0).map((a) => {
        turn.askPendingIds.splice(turn.askPendingIds.indexOf(a.toolUseId), 1)
        turn.askResolved.set(a.toolUseId, a)
        const parentToolRunId = turn.openToolRuns.get(a.toolUseId)?.parentToolRunId
        turn.openToolRuns.delete(a.toolUseId)
        return {
          toolUseId: a.toolUseId,
          output: {
            answers: a.answers,
            ...(a.response !== undefined ? { response: a.response } : {})
          },
          ...(parentToolRunId ? { parentToolRunId } : {})
        }
      })
      writer.recordAskAnswers(turn, answers)
    },
    commit: async (text) =>
      writer.commitUserMessage(turn, { text, createdAt: Date.now() })?.id ?? null,
    end: () => writer.finalizeTurn(turn),
    provider: (event, committed) => writer.persistProviderEvent(event, committed),
    forget: (sessionId) => writer.forgetProviderSession(sessionId),
    settle: async () => {}
  }
}

// 저장 스트림 — 송신기 → 피어 링크 → 구조화 복제 포트 → 피어 링크 → 수신기.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function stream(
  db: DbQueries,
  usage: Usage,
  options: { writer?: HistoryWriter; clock?: () => number } = {}
) {
  const loop = createPeerLoopback()
  const sent: Array<[ClientRef, NormalizedEvent]> = []
  const failTurn = vi.fn()
  const notifyAgent = vi.fn((method: 'turn.persistFailed', payload: unknown) => {
    data.notify(method, payload)
  })
  const receiver = createPersistenceReceiver({
    db,
    usage: () => usage as never,
    notifyAgent,
    ...(options.writer ? { writer: options.writer } : {})
  })
  const data = createPeerLink({
    side: 'data',
    onRequest: (method, payload) => receiver.request(method, payload),
    onNotify: (method, payload) => receiver.notify(method, payload),
    ...(options.clock ? { clock: options.clock } : {})
  })
  const agent = createPeerLink({
    side: 'agent',
    onRequest: () => undefined,
    onNotify: (method, payload) => sender.onNotify(method, payload)
  })
  data.onClosed(() => receiver.peerClosed())
  data.attach(loop.data)
  agent.attach(loop.agent)
  let nextId = 0
  const sender = createPersistenceSender({
    newId: () => String(++nextId),
    link: agent,
    send: (owner, ev) => void sent.push([owner, ev]),
    failTurn
  })
  const drive = (turn = agentTurn()): Driver => ({
    turn,
    event(ev) {
      sender.onTurnEvent(turn, ev)
      sender.relay(turn, ev)
    },
    ask: () => sender.flushAskAnswers(turn, turn.owner),
    commit: (text) =>
      Promise.resolve(sender.commitUserMessage!(turn, { text, createdAt: Date.now() }) ?? null),
    end: () => sender.finalizeTurn!(turn),
    provider: (event, committed) => sender.persistProviderEvent(event, committed),
    forget: (sessionId) => sender.forgetProviderSession(sessionId),
    settle: async () => {
      await tick()
      await tick()
    }
  })
  return { drive, sent, failTurn, notifyAgent, receiver, close: () => loop.agent.close() }
}

const S = 'session-1'
const session = (): NormalizedEvent =>
  ({ type: 'session.updated', sessionId: S, patch: {} }) as NormalizedEvent
const text = (value: string, parentToolRunId?: string): NormalizedEvent =>
  ({
    type: 'message.completed',
    sessionId: S,
    message: { text: value },
    ...(parentToolRunId ? { parentToolRunId } : {})
  }) as NormalizedEvent
const started = (toolRunId: string, toolName: string, parentToolRunId?: string): NormalizedEvent =>
  ({
    type: 'tool.call.started',
    sessionId: S,
    toolRunId,
    toolName,
    args: { for: toolRunId },
    ...(parentToolRunId ? { parentToolRunId } : {})
  }) as NormalizedEvent
const completed = (toolRunId: string, result: unknown, parentToolRunId?: string): NormalizedEvent =>
  ({
    type: 'tool.call.completed',
    sessionId: S,
    toolRunId,
    result,
    isError: false,
    ...(parentToolRunId ? { parentToolRunId } : {})
  }) as NormalizedEvent
const telemetry = (): NormalizedEvent => ({ type: 'telemetry', sessionId: S }) as NormalizedEvent
const background = (sequence: number, taskId: string): BackgroundEvent => ({
  type: 'background.task',
  sessionId: S,
  source: { generation: 'g1', replay: false, sequence, receivedAt: sequence },
  taskId,
  phase: 'updated',
  patch: { status: 'running' }
})

// AC39 의 입력 열 4종(질문 답은 늦은 결과가 오는 경우와 안 오는 경우 둘).
const COLUMNS: Record<string, (d: Driver) => Promise<void>> = {
  '일반 응답': async (d) => {
    d.event(session())
    expect(await d.commit('first words')).toEqual(expect.any(Number))
    d.event({ type: 'message.reasoning', sessionId: S, text: 'thinking' } as NormalizedEvent)
    d.event(text('the answer'))
    d.event(telemetry())
    d.end()
  },
  '중첩 도구': async (d) => {
    d.event(session())
    d.event(started('task-1', 'Task'))
    d.event(started('read-1', 'Read', 'task-1'))
    d.event(completed('read-1', 'file body', 'task-1'))
    d.event(text('child says', 'task-1'))
    d.event(completed('task-1', 'done'))
    d.event(text('parent says'))
    d.event(telemetry())
    d.end()
  },
  '질문 답': async (d) => {
    d.event(session())
    d.event(started('task-1', 'Task'))
    d.event(started('ask-1', 'AskUserQuestion', 'task-1'))
    d.turn.openToolRuns.set('ask-1', { parentToolRunId: 'task-1' } as never)
    d.turn.askPendingIds.push('ask-1')
    d.turn.pendingAskAnswers.push({
      toolUseId: 'ask-1',
      answers: { 'Which?': 'this one' },
      response: 'free text'
    } as never)
    d.ask()
    // 실제 도구 결과가 늦게 빈 값으로 온다 — 저장된 답을 덮지 않는다.
    d.event(completed('ask-1', '', 'task-1'))
    d.event(completed('task-1', 'done'))
    d.event(telemetry())
    d.end()
  },
  // 답만 오고 실제 도구 결과는 오지 않은 채 턴이 끝난다 — 답을 남기는 것은 질문 답 입력뿐이다(VP-38).
  '질문 답 — 늦은 결과 없음': async (d) => {
    d.event(session())
    d.event(started('ask-2', 'AskUserQuestion'))
    d.turn.openToolRuns.set('ask-2', {} as never)
    d.turn.askPendingIds.push('ask-2')
    d.turn.pendingAskAnswers.push({ toolUseId: 'ask-2', answers: { 'Pick?': 'B' } } as never)
    d.ask()
    d.event(telemetry())
    d.end()
  },
  백그라운드: async (d) => {
    const committed = vi.fn()
    // 세션이 아직 없다 — 보류했다가 세션 생성 뒤 기록한다.
    d.provider(background(1, 'bg-1'), committed)
    await d.settle()
    expect(committed).not.toHaveBeenCalled()
    d.event(session())
    await d.settle()
    expect(committed).toHaveBeenCalledOnce()
    d.provider(background(2, 'bg-2'), committed)
    await d.settle()
    expect(committed).toHaveBeenCalledTimes(2)
    d.forget(S)
    d.provider(background(3, 'bg-3'), committed)
    await d.settle()
    // 잊은 세션의 기록은 0이다.
    expect(committed).toHaveBeenCalledTimes(2)
    d.event(telemetry())
    d.end()
  }
}

const noUsage: Usage = { recordTurnUsage: () => {} }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-02T03:04:05Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const connection of connections.splice(0)) connection.close()
})

describe('턴 저장 스트림의 받는 끝', () => {
  it('수신기가 재커밋 결과와 서로 다른 응답에 속한 질문 답의 번호를 보존한다', () => {
    const { db, raw } = openDb()
    db.insertSession({
      id: S,
      backend: 'claude',
      title: '',
      projectId: null,
      createdAt: 1,
      agentKind: 'code'
    })
    const failures = vi.fn()
    const receiver = createPersistenceReceiver({
      db,
      notifyAgent: failures,
      usage: () => undefined
    })
    const turnKey = 'turn-1'
    receiver.notify('turn.begin', {
      turnKey,
      backend: 'claude',
      fields: { dbSessionId: S, agentKind: 'code' }
    })
    const event = (messageKey: string): void =>
      receiver.notify('turn.event', { turnKey, ev: { ...text(messageKey), messageKey } })
    event('a:first')
    expect(db.findMessageByKey(S, 'a:first')?.role).toBe('assistant')
    const commit = { turnKey, batch: { text: 'steer', messageKey: 'u:steer', createdAt: 2 } }
    const first = receiver.request('turn.commitUser', commit)
    const row = db.findMessageByKey(S, 'u:steer')
    expect(row).toBeDefined()
    expect(first).toEqual({ id: row!.id, created: true })
    event('a:second')
    expect(db.findMessageByKey(S, 'a:second')?.role).toBe('assistant')
    expect(receiver.request('turn.commitUser', commit)).toEqual({ id: row!.id, created: false })
    receiver.notify('turn.askAnswers', {
      turnKey,
      answers: [
        { toolUseId: 'q1', output: 'one', messageKey: 'a:first' },
        { toolUseId: 'q2', output: 'two', messageKey: 'a:second' }
      ]
    })
    receiver.notify('turn.end', { turnKey })
    expect(failures).not.toHaveBeenCalled()
    expect(
      raw
        .prepare(
          `
      SELECT m.message_key, p.tool_run_id, json_extract(p.payload_json, '$.result') AS answer
      FROM messages m JOIN message_parts p ON p.message_id = m.id
      WHERE p.type = 'tool_result' ORDER BY p.tool_run_id
    `
        )
        .all()
    ).toEqual([
      { message_key: 'a:first', tool_run_id: 'q1', answer: 'one' },
      { message_key: 'a:second', tool_run_id: 'q2', answer: 'two' }
    ])
    expect(
      raw
        .prepare('SELECT complete FROM messages WHERE session_id = ? AND message_key = ?')
        .get(S, 'a:second')
    ).toEqual({ complete: 1 })
  })

  it('산출물 확인 응답이 원래 메시지 번호로 창에 도착하고 다음 이벤트가 그 뒤에 온다', async () => {
    const { db } = openDb()
    const connection = stream(db, noUsage)
    try {
      const driver = connection.drive()
      driver.event(session())
      await driver.settle()
      db.artifacts.createPublication({
        publicationId: 'pub-1',
        artifactFileId: 'file-1',
        sessionId: S,
        relativePath: 'file-1/report.md',
        filename: 'report.md',
        title: 'report',
        kind: 'markdown',
        sizeBytes: 8,
        hash: 'hash',
        inputSource: 'report.md',
        publishedAt: 1
      })
      driver.event(started('publisher', 'mcp__orcinus_orca_artifacts__publish_artifact'))
      const original = connection.sent.at(-1)?.[1]
      expect(original).toMatchObject({ type: 'tool.call.started', messageKey: expect.any(String) })
      const key = original?.type === 'tool.call.started' ? original.messageKey : undefined
      await driver.commit('steer')
      driver.event(text('next'))
      const receipt = JSON.stringify({
        type: 'orcinus-orca.artifact.published',
        version: 1,
        publicationId: 'pub-1'
      })
      driver.event(completed('publisher', receipt))
      driver.event(text('after receipt'))
      await driver.settle()
      expect(connection.failTurn).not.toHaveBeenCalled()
      expect(connection.sent.slice(-2).map(([, ev]) => ev)).toEqual([
        expect.objectContaining({
          type: 'tool.call.completed',
          messageKey: key,
          messageKeySource: 'owner',
          artifact: expect.objectContaining({ publicationId: 'pub-1', filename: 'report.md' })
        }),
        expect.objectContaining({ type: 'message.completed', message: { text: 'after receipt' } })
      ])
      const owner = db.findMessageByKey(S, key!)
      expect(owner).toBeDefined()
      expect(
        db
          .loadParts(S)
          .filter((p) => p.type === 'artifact')
          .map((p) => p.message_id)
      ).toEqual([owner!.id])
    } finally {
      connection.close()
    }
  })

  it.each(Object.keys(COLUMNS))(
    'AC39 — %s 열을 스트림으로 저장한 DB 는 한 프로세스 경로로 저장한 DB 와 같다',
    async (name) => {
      const column = COLUMNS[name]!
      const a = openDb()
      const b = openDb()
      const viaDirect = direct(a.db, noUsage)
      await column(viaDirect)
      const viaStream = stream(b.db, noUsage).drive()
      await column(viaStream)
      await viaStream.settle()
      const expected = dump(a.raw)
      expect(expected.sessions).toHaveLength(1)
      expect(withoutMessageKeys(dump(b.raw))).toEqual(expected)
    }
  )

  it('질문 답 열 — 답은 부모 도구 연결과 함께 도구 결과 파트로 남고 늦은 빈 결과가 덮지 않는다', async () => {
    const { db, raw } = openDb()
    const d = stream(db, noUsage).drive()
    await COLUMNS['질문 답']!(d)
    await d.settle()
    const rows = raw
      .prepare(
        "SELECT payload_json FROM message_parts WHERE tool_run_id = 'ask-1' AND type = 'tool_result'"
      )
      .all() as Array<{ payload_json: string }>
    expect(rows.map((row) => JSON.parse(row.payload_json))).toEqual([
      expect.objectContaining({
        result: { answers: { 'Which?': 'this one' }, response: 'free text' },
        isError: false,
        parentToolRunId: 'task-1'
      })
    ])
  })

  it('사용량이 이력의 현재 어시스턴트 메시지를 리셋 전에 읽는다 (SD-05′)', async () => {
    const { db } = openDb()
    const seen: Array<number | null> = []
    const usage: Usage = {
      recordTurnUsage: (turn) => void seen.push(turn.currentAssistantMessageId)
    }
    const d = stream(db, usage).drive()
    d.event(session())
    d.event(text('answer'))
    d.event(telemetry())
    await d.settle()
    expect(seen).toEqual([expect.any(Number)])
  })

  it('도중 필드가 바뀌면 다음 입력에 실려 저장 쪽 사본이 따라간다 (MD-09)', async () => {
    const { db } = openDb()
    const d = stream(db, noUsage).drive(agentTurn({ providerKey: 'before' }))
    d.turn.providerKey = 'after'
    d.event(session())
    await d.settle()
    expect(db.getSessionById(S)).toMatchObject({ provider_key: 'after', backend: 'opencode' })
  })

  it('저장이 던지면 에이전트에 1건 알리고 그 턴의 이후 입력을 버린다 — 다른 턴은 계속 저장한다', async () => {
    const { db } = openDb()
    const writer = writerFor(db)
    const persist = vi.spyOn(writer, 'persist')
    const h = stream(db, noUsage, { writer })
    const bad = h.drive()
    const good = h.drive(agentTurn())
    bad.event(session())
    await bad.settle()
    persist.mockImplementationOnce(() => {
      throw new Error('disk full')
    })
    bad.event(text('lost'))
    await bad.settle()
    expect(h.notifyAgent).toHaveBeenCalledExactlyOnceWith('turn.persistFailed', {
      turnKey: expect.any(String),
      message: 'disk full'
    })
    expect(h.failTurn).toHaveBeenCalledExactlyOnceWith(bad.turn, 'disk full')
    const calls = persist.mock.calls.length
    bad.event(text('after failure'))
    bad.end()
    await bad.settle()
    expect(persist.mock.calls.length).toBe(calls)
    good.event(session())
    good.event(text('kept'))
    await good.settle()
    expect(persist.mock.calls.length).toBe(calls + 2)
  })

  it('에이전트 호스트가 죽으면 열린 턴 둘을 복구 규칙으로 바로 마감한다 (AC29′)', async () => {
    const open = (d: Driver, sessionId: string): void => {
      d.event({ type: 'session.updated', sessionId, patch: {} } as NormalizedEvent)
      d.event({ ...started(`tool-${sessionId}`, 'Bash'), sessionId } as NormalizedEvent)
      d.event({ ...text(`partial ${sessionId}`), sessionId } as NormalizedEvent)
    }
    const a = openDb()
    for (const id of ['s-a', 's-b']) open(direct(a.db, noUsage), id)
    // 프로세스가 턴 도중 죽은 뒤 다시 떠서 복구한 것과 같다.
    for (const id of ['s-a', 's-b']) recoverSessionHistory(a.db, { sessionId: id })
    const b = openDb()
    const h = stream(b.db, noUsage)
    const first = h.drive()
    const second = h.drive(agentTurn())
    open(first, 's-a')
    open(second, 's-b')
    await first.settle()
    const before = dump(b.raw)
    h.close()
    await first.settle()
    const after = dump(b.raw)
    expect(after).not.toEqual(before)
    expect(withoutMessageKeys(after)).toEqual(dump(a.raw))
    // 끊긴 도구 호출마다 결과 파트가 생겼다.
    expect(
      b.raw.prepare("SELECT count(*) AS n FROM message_parts WHERE type = 'tool_result'").get()
    ).toEqual({ n: 2 })
  })

  it('60ms 걸린 턴 이벤트 수신은 메시지 종류 이름과 함께 한 건 기록된다 (AC6′)', async () => {
    const record = vi.spyOn(stall, 'recordStall').mockImplementation(() => {})
    const { db } = openDb()
    const writer = writerFor(db)
    let now = 0
    const persist = vi.spyOn(writer, 'persist').mockImplementation(() => {
      now += 60
    })
    const d = stream(db, noUsage, { writer, clock: () => now }).drive()
    d.event(text('slow'))
    await d.settle()
    expect(persist).toHaveBeenCalledOnce()
    expect(record.mock.calls.filter(([entry]) => entry.label === 'turn.event')).toEqual([
      [expect.objectContaining({ source: 'peer', label: 'turn.event', durationMs: 60 })]
    ])
  })
})
