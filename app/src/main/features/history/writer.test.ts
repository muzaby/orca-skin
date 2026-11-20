import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { openFileDatabase } from '../../infra/db/file-database'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// writer → infra/ipc/send → electron(webContents) 런타임 체인을 절단 — 이 스위트는
// electron 바이너리 없이도 돈다(hermetic, 0104 선례). 테스트는 send 를 호출하지 않는다.

import { duplicateToolResultEvents } from '../../../shared/duplicate-tool-result.testfixture'
import { HistoryWriter } from './writer'
import { DbQueries } from '../../infra/db/queries'
import type { AttachmentView, DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import { partFromRow } from '../../infra/ipc/dto'
import type { TurnAskAnswer } from '../../../shared/peer-protocol'
import type { TurnContext } from '../../contracts/turn'
import { applyMigrations } from '../../infra/db/migrate'
import { loadSession } from './reader'

type HistoryWriterAllowsMissingPolicy =
  [DbQueries] extends ConstructorParameters<typeof HistoryWriter> ? true : false

const HISTORY_WRITER_ALLOWS_MISSING_POLICY: HistoryWriterAllowsMissingPolicy = false

it('requires an explicit response-boundary policy at construction', () => {
  expect(HISTORY_WRITER_ALLOWS_MISSING_POLICY).toBe(false)
})

// persistUserMessage 만 검증 — appendMessage/appendPart 만 모의한다.
function makePersistence(): {
  persistence: HistoryWriter
  appendMessage: ReturnType<typeof vi.fn>
  appendPart: ReturnType<typeof vi.fn>
} {
  const appendMessage = vi.fn(() => 7)
  const appendPart = vi.fn(() => 0)
  const db = { appendMessage, appendPart } as unknown as DbQueries
  const persistence = new HistoryWriter(db, () => false)
  return { persistence, appendMessage, appendPart }
}

const imageView: AttachmentView = {
  id: 'a1',
  name: 'pic.png',
  mimeType: 'image/png',
  kind: 'image',
  previewDataUrl: 'data:image/jpeg;base64,QUJD'
}
const fileView: AttachmentView = {
  id: 'a2',
  name: 'spec.md',
  mimeType: 'text/markdown',
  kind: 'file'
}

it('round trips the received message origin in the text part without rewriting the prompt', () => {
  const { persistence, appendPart } = makePersistence()
  const origin = { kind: 'scheduled' as const }
  persistence.persistUserMessage('s', 'check now', 1, undefined, undefined, origin)
  const row = appendPart.mock.calls[0][0]
  expect(
    partFromRow({ type: row.type, payload_json: row.payloadJson, tool_run_id: null } as Parameters<
      typeof partFromRow
    >[0])
  ).toEqual({ type: 'text', text: 'check now', origin })
})

describe('Work boundary persistence', () => {
  it('uses the injected response-boundary policy', () => {
    const connection = new Database(':memory:')
    try {
      applyMigrations(connection)
      const queries = new DbQueries(connection)
      queries.insertSession({
        id: 's1',
        backend: 'claude',
        title: null,
        projectId: null,
        createdAt: 1,
        agentKind: 'work'
      })
      const writer = new HistoryWriter(queries, () => false)
      writer.persist(turnFor(), begin('disabled'))
      expect(queries.loadParts('s1')).toEqual([])
    } finally {
      connection.close()
    }
  })

  const turnFor = (): TurnContext =>
    ({
      agentKind: 'work',
      dbSessionId: 's1',
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null,
      askResolved: new Map()
    }) as unknown as TurnContext
  const begin = (id: string): Extract<NormalizedEvent, { type: 'response.boundary' }> => ({
    type: 'response.boundary',
    sessionId: 's1',
    boundary: { phase: 'begin', id }
  })
  const end = (id: string): Extract<NormalizedEvent, { type: 'response.boundary' }> => ({
    type: 'response.boundary',
    sessionId: 's1',
    boundary: { phase: 'end', id, outcome: 'ended' }
  })
  const text: NormalizedEvent = {
    type: 'message.completed',
    sessionId: 's1',
    message: { text: 'searchable answer' }
  }

  it('appends end to the completed original row, preserves FTS, and survives disk reopen and fork', () => {
    const directory = mkdtempSync(join(tmpdir(), 'orcinus-orca-response-boundary-'))
    const filename = join(directory, 'history.db')
    let connection = openFileDatabase(filename)
    try {
      applyMigrations(connection)
      const queries = new DbQueries(connection)
      const writer = new HistoryWriter(queries, () => true)
      const turn = Object.assign(turnFor(), {
        titleAdapter: { id: 'claude' as const },
        pendingUserText: null,
        pendingProjectId: null,
        cwd: '/fixture',
        extraDirs: [],
        isNewSession: true
      })
      writer.persist(turn, { type: 'session.updated', sessionId: 's1', patch: {} })
      writer.persist(turn, begin('segment'))
      writer.persist(turn, text)
      const messageId = turn.currentAssistantMessageId
      writer.persist(turn, { type: 'telemetry', sessionId: 's1' })
      expect(turn.currentAssistantMessageId).toBeNull()
      const before = connection.prepare('SELECT id,content,complete FROM messages').all()
      writer.persist(turn, end('segment'))
      expect(connection.prepare('SELECT id,content,complete FROM messages').all()).toEqual(before)
      expect(before).toEqual([{ id: messageId, content: 'searchable answer', complete: 1 }])
      expect(queries.loadParts('s1').map(partFromRow)).toEqual([
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'segment' } },
        { type: 'text', text: 'searchable answer' },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'segment', outcome: 'ended' } }
      ])
      expect(
        connection
          .prepare("SELECT count(*) AS n FROM messages_fts WHERE messages_fts MATCH 'searchable'")
          .get()
      ).toEqual({ n: 1 })
      queries.insertSession({
        id: 'fork',
        backend: 'claude',
        title: null,
        projectId: null,
        createdAt: 2,
        agentKind: 'work'
      })
      queries.copyMessagesToSession('s1', 'fork')
      const expected = loadSession(queries, 's1', () => '/fallback')
      expect(expected?.agentKind).toBe('work')
      expect(loadSession(queries, 'fork', () => '/fallback')?.messages).toEqual(
        expected?.messages.map((message) => ({ ...message, id: 'm:2' }))
      )
      connection.close()
      connection = openFileDatabase(filename)
      const reopened = new DbQueries(connection)
      expect(loadSession(reopened, 's1', () => '/fallback')).toEqual(expected)
      expect(loadSession(reopened, 'fork', () => '/fallback')?.messages).toEqual(
        expected?.messages.map((message) => ({ ...message, id: 'm:2' }))
      )
    } finally {
      if (connection.open) connection.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('does not synthesize end after a crash or create rows for unmatched/foreign ends', () => {
    const connection = new Database(':memory:')
    try {
      applyMigrations(connection)
      const queries = new DbQueries(connection)
      queries.insertSession({
        id: 's1',
        backend: 'claude',
        title: null,
        projectId: null,
        createdAt: 1
      })
      const writer = new HistoryWriter(queries, () => true)
      const turn = turnFor()
      writer.persist(turn, end('missing'))
      expect(queries.loadParts('s1')).toEqual([])
      writer.persist(turn, begin('crash'))
      writer.persist(turn, text)
      writer.persist(turn, end('wrong'))
      writer.persist(turn, { ...end('crash'), sessionId: 'foreign' })
      expect(loadSession(queries, 's1', () => '/fallback')?.messages).toEqual([
        {
          id: 'm:1',
          role: 'assistant',
          createdAt: expect.any(Number),
          incomplete: true,
          parts: [
            { type: 'response_boundary', boundary: { phase: 'begin', id: 'crash' } },
            { type: 'text', text: 'searchable answer' }
          ]
        }
      ])
    } finally {
      connection.close()
    }
  })

  it('moves the end address when later output creates a new assistant row after telemetry', () => {
    const connection = new Database(':memory:')
    try {
      applyMigrations(connection)
      const queries = new DbQueries(connection)
      queries.insertSession({
        id: 's1',
        backend: 'claude',
        title: null,
        projectId: null,
        createdAt: 1
      })
      const writer = new HistoryWriter(queries, () => true)
      const turn = turnFor()
      writer.persist(turn, begin('segment'))
      writer.persist(turn, text)
      const first = turn.currentAssistantMessageId
      writer.persist(turn, { type: 'telemetry', sessionId: 's1' })
      writer.persist(turn, text)
      const last = turn.currentAssistantMessageId
      writer.persist(turn, end('segment'))
      expect(last).not.toBe(first)
      const rows = queries.loadParts('s1')
      expect(rows.at(-1)).toMatchObject({
        message_id: last,
        type: 'response_boundary',
        complete: 0
      })
      expect(
        rows.filter((row) => row.message_id === first).every((row) => row.complete === 1)
      ).toBe(true)
    } finally {
      connection.close()
    }
  })
})

describe('HistoryWriter.persistUserMessage — 첨부 영속', () => {
  it('committed requirements survive real message_parts storage and the session-load parser', () => {
    const db = new Database(':memory:')
    try {
      applyMigrations(db)
      db.prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at) VALUES ('s1', 'claude', 1, 1)"
      ).run()
      const queries = new DbQueries(db)
      const writer = new HistoryWriter(queries, () => false)
      const requirements: DiffRequirementAnchor[] = [
        {
          sessionId: 's1',
          baselineCommit: 'base',
          filePath: 'src/a.ts',
          oldLine: null,
          newLine: 7,
          hunkHeader: '@@ -1 +1,7 @@',
          contextBefore: ['before'],
          contextAfter: [],
          comment: '첫 줄\n두 번째 줄 <tag>',
          createdAt: 1
        }
      ]
      const turn = {
        dbSessionId: 's1',
        currentAssistantMessageId: null,
        assistantText: '',
        providerKey: null
      } as unknown as TurnContext
      writer.commitUserMessage(turn, {
        text: 'apply',
        createdAt: 2,
        attachmentViews: [fileView],
        requirements
      })
      const parts = queries.loadParts('s1').map(partFromRow)
      expect(parts).toEqual([
        { type: 'text', text: 'apply' },
        { type: 'attachment', attachments: [fileView] },
        { type: 'diff_requirements', requirements }
      ])
      expect(queries.getSessionById('s1')?.last_message_preview).toBe('apply')
    } finally {
      db.close()
    }
  })

  it('첨부가 있으면 text 파트 + attachment 파트를 같은 메시지에 append 한다', () => {
    const { persistence, appendMessage, appendPart } = makePersistence()
    persistence.persistUserMessage('s1', '이거 봐', 100, [imageView, fileView])

    expect(appendMessage).toHaveBeenCalledTimes(1)
    expect(appendPart).toHaveBeenCalledTimes(2)
    expect(appendPart.mock.calls[0]![0]).toMatchObject({ messageId: 7, type: 'text' })
    const attachmentCall = appendPart.mock.calls[1]![0] as { type: string; payloadJson: string }
    expect(attachmentCall.type).toBe('attachment')
    expect(JSON.parse(attachmentCall.payloadJson)).toEqual({ attachments: [imageView, fileView] })
  })

  it('첨부가 없으면 attachment 파트를 만들지 않는다', () => {
    const { persistence, appendPart } = makePersistence()
    persistence.persistUserMessage('s1', 'plain', 100)
    expect(appendPart).toHaveBeenCalledTimes(1)
    expect(appendPart.mock.calls[0]![0]).toMatchObject({ type: 'text' })

    persistence.persistUserMessage('s1', 'empty', 100, [])
    expect(appendPart).toHaveBeenCalledTimes(2) // text only, 여전히 attachment 없음
  })
})

describe('HistoryWriter — session baseline birth persistence', () => {
  it('session.updated는 turn의 출생 baseline을 insertSession에 한 번만 전달한다', () => {
    const insertSession = vi.fn()
    const db = {
      insertSession,
      updateSessionPreview: vi.fn(),
      updateSessionProviderKey: vi.fn(),
      commitUserWrite: (write: () => unknown) => write()
    }
    const persistence = new HistoryWriter(db as unknown as DbQueries, () => false)
    const turn = {
      agentKind: 'work',
      dbSessionId: null,
      initialTitle: null,
      pendingUserText: null,
      pendingProjectId: null,
      providerKey: null,
      cwd: '/repo',
      extraDirs: [],
      sessionBaseline: 'a'.repeat(40),
      sessionBaselineRef: 'main',
      titleAdapter: { id: 'claude' },
      isNewSession: true
    } as unknown as TurnContext

    persistence.persist(turn, {
      type: 'session.updated',
      sessionId: 'new-session'
    } as NormalizedEvent)

    expect(insertSession).toHaveBeenCalledWith(
      // 0211 ΔV4 — 커밋과 이름이 **한 insert** 로 간다(D-070).
      expect.objectContaining({
        id: 'new-session',
        agentKind: 'work',
        baselineOid: 'a'.repeat(40),
        baselineRef: 'main'
      })
    )
  })

  it('resumed session.updated cannot replace the birth baseline in the database', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const queries = new DbQueries(db)
    const persistence = new HistoryWriter(queries, () => false)
    const turn = (
      sessionBaseline: string | null,
      isNewSession: boolean,
      sessionBaselineRef: string | null = null
    ): TurnContext =>
      ({
        dbSessionId: null,
        initialTitle: null,
        pendingUserText: null,
        pendingProjectId: null,
        providerKey: null,
        cwd: '/repo',
        extraDirs: [],
        sessionBaseline,
        sessionBaselineRef,
        titleAdapter: { id: 'claude' },
        isNewSession
      }) as unknown as TurnContext

    persistence.persist(turn('a'.repeat(40), true, 'main'), {
      type: 'session.updated',
      sessionId: 'persisted-session'
    } as NormalizedEvent)
    persistence.persist(turn('b'.repeat(40), false, 'feature'), {
      type: 'session.updated',
      sessionId: 'persisted-session'
    } as NormalizedEvent)

    // 이후 턴이 브랜치를 바꿔 보내도 행은 **불변**이다 — 1회 기록이 D-070·D-033 의 계약이다.
    // `bornAt`(=`created_at`)은 세션 출생 시각이라 값을 고정할 수 없다. 다만 `toEqual` 로
    // **정확한 형태**를 유지한다 — `toMatchObject` 로 느슨하게 두면 새 필드가 조용히 는다.
    expect(queries.getSessionBaseline('persisted-session')).toEqual({
      oid: 'a'.repeat(40),
      ref: 'main',
      bornAt: expect.any(Number)
    })
    db.close()
  })
})

// finalize 흐름(0107) — content(FTS 캐시) 기록은 스트리밍 중이 아니라 메시지 마감 시 1회.
function makeFinalizeHarness(): {
  persistence: HistoryWriter
  db: {
    appendMessage: ReturnType<typeof vi.fn>
    appendPart: ReturnType<typeof vi.fn>
    updateMessageContent: ReturnType<typeof vi.fn>
    markMessageComplete: ReturnType<typeof vi.fn>
    updateSessionPreview: ReturnType<typeof vi.fn>
    updateSessionProviderKey: ReturnType<typeof vi.fn>
  }
  turn: TurnContext
} {
  const db = {
    appendMessage: vi.fn(() => 7),
    appendPart: vi.fn(() => 0),
    updateMessageContent: vi.fn(),
    markMessageComplete: vi.fn(),
    updateSessionPreview: vi.fn(),
    updateSessionProviderKey: vi.fn(),
    commitUserWrite: (write: () => unknown) => write()
  }
  const persistence = new HistoryWriter(db as unknown as DbQueries, () => false)
  const turn = {
    dbSessionId: 's1',
    currentAssistantMessageId: null,
    assistantText: '',
    providerKey: null
  } as unknown as TurnContext
  return { persistence, db, turn }
}

function completedText(text: string, parentToolRunId?: string): NormalizedEvent {
  return {
    type: 'message.completed',
    sessionId: 's1',
    message: { text },
    ...(parentToolRunId !== undefined ? { parentToolRunId } : {})
  } as NormalizedEvent
}

describe('HistoryWriter — assistant content 마감 1회 기록 (0107)', () => {
  it('스트리밍 중 텍스트 블록에는 content 를 쓰지 않고, telemetry 마감 시 누적 전체를 1회 기록한다', () => {
    const { persistence, db, turn } = makeFinalizeHarness()
    persistence.persist(turn, completedText('하나 '))
    persistence.persist(turn, completedText('둘 '))
    persistence.persist(turn, completedText('셋'))

    expect(db.updateMessageContent).not.toHaveBeenCalled()
    // 사이드바 프리뷰 라이브 갱신은 유지된다.
    expect(db.updateSessionPreview).toHaveBeenCalledTimes(3)

    persistence.persist(turn, { type: 'telemetry', sessionId: 's1' } as NormalizedEvent)
    expect(db.updateMessageContent).toHaveBeenCalledTimes(1)
    expect(db.updateMessageContent).toHaveBeenCalledWith(7, '하나 둘 셋')
    expect(db.markMessageComplete).toHaveBeenCalledTimes(1)
    expect(db.markMessageComplete).toHaveBeenCalledWith(7)
    expect(turn.currentAssistantMessageId).toBeNull()
    expect(turn.assistantText).toBe('')
  })

  it('서브에이전트 child 텍스트(parentToolRunId)는 content 누적에서 제외된다', () => {
    const { persistence, db, turn } = makeFinalizeHarness()
    persistence.persist(turn, completedText('본문'))
    persistence.persist(turn, completedText('child', 't1'))
    persistence.persist(turn, { type: 'telemetry', sessionId: 's1' } as NormalizedEvent)
    expect(db.updateMessageContent).toHaveBeenCalledWith(7, '본문')
  })

  it('commitUserMessage 가 진행 중 assistant 메시지를 그 시점 누적분으로 마감한다', () => {
    const { persistence, db, turn } = makeFinalizeHarness()
    persistence.persist(turn, completedText('응답-전'))
    persistence.commitUserMessage(turn, { text: '유저 발화', createdAt: 200 })

    expect(db.updateMessageContent).toHaveBeenCalledTimes(1)
    expect(db.updateMessageContent).toHaveBeenCalledWith(7, '응답-전')
    expect(db.markMessageComplete).toHaveBeenCalledWith(7)
    expect(turn.currentAssistantMessageId).toBeNull()
  })

  it('finalizeTurn 은 진행 중 메시지가 없으면 no-op, 있으면 마감 + reset 한다', () => {
    const { persistence, db, turn } = makeFinalizeHarness()
    persistence.finalizeTurn(turn)
    expect(db.updateMessageContent).not.toHaveBeenCalled()

    persistence.persist(turn, completedText('중단 전 텍스트'))
    persistence.finalizeTurn(turn)
    expect(db.updateMessageContent).toHaveBeenCalledWith(7, '중단 전 텍스트')
    expect(db.markMessageComplete).toHaveBeenCalledWith(7)
    expect(turn.currentAssistantMessageId).toBeNull()
    expect(turn.assistantText).toBe('')
  })
})

// 0204 §10 EP-07 — 구조화 출력은 라이브 이벤트와 영속 파트 **두 곳**에 같은 규칙으로 실려야
// 한다. 여기가 빠지면 작업 타일이 재로드 후 비어 보인다(AC18).
describe('HistoryWriter — TaskXXX 구조화 출력 영속 (0204)', () => {
  function harness(): {
    persistence: HistoryWriter
    upsertToolResultPartInSession: ReturnType<typeof vi.fn>
    turn: TurnContext
  } {
    const upsertToolResultPartInSession = vi.fn()
    const db = {
      appendMessage: vi.fn(() => 7),
      appendPart: vi.fn(() => 0),
      upsertToolResultPartInSession,
      updateSessionPreview: vi.fn(),
      updateSessionProviderKey: vi.fn(),
      commitUserWrite: (write: () => unknown) => write()
    }
    const persistence = new HistoryWriter(db as unknown as DbQueries, () => false)
    const turn = {
      dbSessionId: 's1',
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null,
      askResolved: new Map()
    } as unknown as TurnContext
    return { persistence, upsertToolResultPartInSession, turn }
  }

  it('structuredOutput 을 tool_result payload 에 싣는다', () => {
    const { persistence, upsertToolResultPartInSession, turn } = harness()
    const structured = { task: { id: '3', subject: '테스트 작성' } }
    persistence.persist(turn, {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 't1',
      result: 'ok',
      isError: false,
      structuredOutput: structured
    } as NormalizedEvent)

    const payload = JSON.parse(upsertToolResultPartInSession.mock.calls[0][3] as string) as {
      structuredOutput?: unknown
    }
    expect(payload.structuredOutput).toEqual(structured)
  })

  it('없으면 키를 만들지 않는다 — 일반 도구 결과는 그대로다', () => {
    const { persistence, upsertToolResultPartInSession, turn } = harness()
    persistence.persist(turn, {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 't1',
      result: 'ok',
      isError: false
    } as NormalizedEvent)

    const payload = JSON.parse(upsertToolResultPartInSession.mock.calls[0][3] as string) as Record<
      string,
      unknown
    >
    expect('structuredOutput' in payload).toBe(false)
  })
})

// 0239 AC5·AC8 · IT-02 · §10 EP-01 ⑤ — 비실행 사유 영속과 last-wins.
describe('HistoryWriter — 비실행 사유 영속 (0239)', () => {
  const started = (id: string): NormalizedEvent => ({
    type: 'tool.call.started',
    sessionId: 's1',
    toolRunId: id,
    toolName: 'Bash',
    args: {}
  })
  function withDb(
    check: (queries: DbQueries, writer: HistoryWriter, turn: TurnContext) => void
  ): void {
    const db = new Database(':memory:')
    try {
      applyMigrations(db)
      db.prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at) VALUES ('s1', 'claude', 1, 1)"
      ).run()
      const queries = new DbQueries(db)
      const writer = new HistoryWriter(queries, () => false)
      const turn = {
        dbSessionId: 's1',
        currentAssistantMessageId: null,
        assistantText: '',
        providerKey: null,
        askResolved: new Map()
      } as unknown as TurnContext
      check(queries, writer, turn)
    } finally {
      db.close()
    }
  }
  const toolResults = (queries: DbQueries): unknown[] =>
    queries
      .loadParts('s1')
      .map(partFromRow)
      .filter((part) => part.type === 'tool_result')

  it('AC8 — nonExecution 을 payload 에 싣고 reader 가 같은 값으로 복원한다', () => {
    withDb((queries, writer, turn) => {
      writer.persist(turn, started('t1'))
      writer.persist(turn, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 't1',
        result: 'The user rejected this tool use',
        isError: true,
        nonExecution: { source: 'sdk', kind: 'user-rejected', userFeedback: '다음에' }
      })
      expect(toolResults(queries)).toEqual([
        {
          type: 'tool_result',
          toolRunId: 't1',
          result: 'The user rejected this tool use',
          isError: true,
          nonExecution: { source: 'sdk', kind: 'user-rejected', userFeedback: '다음에' }
        }
      ])
      const session = loadSession(queries, 's1', () => '/w')
      const loaded = session?.messages.flatMap((message) => message.parts)
      expect(loaded?.find((part) => part.type === 'tool_result')).toMatchObject({
        nonExecution: { source: 'sdk', kind: 'user-rejected', userFeedback: '다음에' }
      })
    })
  })

  it('사유가 없으면 키를 만들지 않는다 — 끝까지 실행된 결과는 그대로다', () => {
    withDb((queries, writer, turn) => {
      writer.persist(turn, started('t1'))
      writer.persist(turn, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 't1',
        result: 'ok',
        isError: false
      })
      expect('nonExecution' in (toolResults(queries)[0] as object)).toBe(false)
    })
  })

  it('AC5 — host 정착 뒤 같은 id 의 실제 결과가 오면 한 행을 덮어쓴다(last-wins)', () => {
    withDb((queries, writer, turn) => {
      writer.persist(turn, started('t1'))
      writer.persist(turn, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 't1',
        result: { reason: 'not_executed', message: '실행되지 않았습니다' },
        isError: true,
        nonExecution: { source: 'host', kind: 'no_result' }
      })
      writer.persist(turn, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 't1',
        result: 'late real output',
        isError: false
      })
      expect(toolResults(queries)).toEqual([
        { type: 'tool_result', toolRunId: 't1', result: 'late real output', isError: false }
      ])
    })
  })
})

describe('HistoryWriter — conversation engine key', () => {
  it('stores the selected engine key at creation and replaces it with a later turn key on commit', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const queries = new DbQueries(db)
    const persistence = new HistoryWriter(queries, () => false)
    const turn = (providerKey: string, dbSessionId: string | null): TurnContext =>
      ({
        agentKind: 'code',
        dbSessionId,
        initialTitle: null,
        pendingUserText: dbSessionId ? null : 'first',
        pendingProjectId: null,
        providerKey,
        cwd: '/repo',
        extraDirs: [],
        sessionBaseline: null,
        sessionBaselineRef: null,
        titleAdapter: { id: 'opencode' },
        isNewSession: dbSessionId === null,
        currentAssistantMessageId: null,
        assistantText: ''
      }) as unknown as TurnContext

    // A saved conversation selects its engine from this key when the request names none.
    persistence.persist(turn('opencode-other', null), {
      type: 'session.updated',
      sessionId: 'conversation'
    } as NormalizedEvent)
    expect(queries.getSessionById('conversation')?.provider_key).toBe('opencode-other')

    persistence.commitUserMessage(turn('opencode-local', 'conversation'), {
      text: 'next',
      createdAt: 2
    })
    expect(queries.getSessionById('conversation')?.provider_key).toBe('opencode-local')
    expect(loadSession(queries, 'conversation', () => '/repo')?.providerKey).toBe('opencode-local')
    db.close()
  })
})

it('w16 keeps a replay from closing the current assistant row before a persisted error', () => {
  const connection = new Database(':memory:')
  try {
    applyMigrations(connection)
    const db = new DbQueries(connection)
    db.insertSession({ id: 's', backend: 'claude', title: null, projectId: null, createdAt: 1 })
    const writer = new HistoryWriter(db, () => false)
    const turn = {
      dbSessionId: 's',
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null
    } as unknown as TurnContext
    const batch = { text: 'user input', messageKey: 'u:1', createdAt: 2 }
    expect(writer.commitUserMessage(turn, batch)).toEqual({ id: 1, created: true })
    writer.persist(turn, {
      type: 'message.completed',
      sessionId: 's',
      messageKey: 'a:1',
      message: { text: 'before the error' }
    })
    const current = turn.currentAssistantMessageId
    const preview = db.getSessionById('s')?.last_message_preview
    expect(writer.commitUserMessage(turn, { ...batch, createdAt: 3 })).toEqual({
      id: 1,
      created: false
    })
    expect(turn.currentAssistantMessageId).toBe(current)
    expect(turn.currentAssistantMessageKey).toBe('a:1')
    expect(db.getSessionById('s')?.last_message_preview).toBe(preview)
    expect(() => writer.commitUserMessage(turn, { ...batch, text: 'different' })).toThrow(
      'different content'
    )
    writer.persist(turn, {
      type: 'error',
      sessionId: 's',
      messageKey: 'a:1',
      error: { category: 'stream_error', message: 'failed', retryable: false }
    })
    expect(loadSession(db, 's', () => '/fallback')?.messages).toMatchObject([
      { id: 'u:1', role: 'user', parts: [{ type: 'text', text: 'user input' }] },
      {
        id: 'a:1',
        role: 'assistant',
        incomplete: true,
        parts: [
          { type: 'text', text: 'before the error' },
          { type: 'error', error: { message: 'failed' } }
        ]
      }
    ])
  } finally {
    connection.close()
  }
})

describe('VP-06 HistoryWriter message_key & session-scoped upsert (w1~w7, w9~w15)', () => {
  function setupDb(): {
    connection: Database.Database
    db: DbQueries
    writer: HistoryWriter
    makeTurn: (sessionId?: string) => TurnContext
  } {
    const connection = new Database(':memory:')
    applyMigrations(connection)
    const db = new DbQueries(connection)
    db.insertSession({ id: 's1', backend: 'claude', title: null, projectId: null, createdAt: 1 })
    db.insertSession({ id: 's2', backend: 'claude', title: null, projectId: null, createdAt: 1 })
    const writer = new HistoryWriter(db, () => true)
    const makeTurn = (sessionId = 's1'): TurnContext =>
      ({
        dbSessionId: sessionId,
        currentAssistantMessageId: null,
        assistantText: '',
        providerKey: null,
        openToolRuns: new Map(),
        askPendingIds: [],
        pendingAskAnswers: [],
        askResolved: new Map(),
        planToolInputs: new Map(),
        pendingPlanToolCalls: []
      }) as unknown as TurnContext
    return { connection, db, writer, makeTurn }
  }

  it('x14 persists the single paired result for a duplicate tool call', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      for (const event of duplicateToolResultEvents()) writer.persist(turn, event)
      writer.finalizeTurn(turn)
      const parts = loadSession(db, 's1', () => '/tmp')!.messages.flatMap(
        (message) => message.parts
      )
      expect(
        parts.filter((part) => part.type === 'tool_call' && part.toolRunId === 'dup')
      ).toHaveLength(2)
      expect(parts.filter((part) => part.type === 'tool_result')).toEqual([
        expect.objectContaining({ toolRunId: 'dup', result: 'paired output' })
      ])
    } finally {
      connection.close()
    }
  })

  it('w12 binds a new user row once and accepts recovery only for a fresh native commit', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const lookup = vi.spyOn(db, 'findMessageByKey')
      const legacy = { text: 'legacy', createdAt: 0 }
      const unkeyed = writer.commitUserMessage(turn, legacy)!
      expect(writer.commitUserMessage(turn, legacy)!.id).not.toBe(unkeyed.id)
      expect(lookup).not.toHaveBeenCalled()
      const bind = vi.spyOn(db.nativeHistory, 'bind')
      const recover = vi.spyOn(db.nativeHistory, 'acceptRecovery')
      const first = { text: 'note', messageKey: 'u:A', createdAt: 1, nativeMessageId: 'n-A' }
      const a = writer.commitUserMessage(turn, first)!
      expect(() => writer.commitUserMessage(turn, first)).not.toThrow()
      expect(writer.commitUserMessage(turn, first)).toEqual({ id: a.id, created: false })
      const b = writer.commitUserMessage(turn, { text: 'plain', messageKey: 'u:B', createdAt: 2 })!
      writer.commitUserMessage(turn, {
        text: 'plain',
        messageKey: 'u:B',
        createdAt: 3,
        nativeMessageId: 'n-B'
      })
      expect(bind.mock.calls).toEqual([
        [a.id, 'n-A'],
        [b.id, 'n-B']
      ])
      expect(recover.mock.calls).toEqual([['s1', 'n-A']])
    } finally {
      connection.close()
    }
  })

  it('w1/w3 routes late text and native bindings to their own row without disturbing the active row', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const send = (
        text: string,
        fields: Partial<Extract<NormalizedEvent, { type: 'message.completed' }>> = {}
      ): void =>
        writer.persist(turn, {
          type: 'message.completed',
          sessionId: 's1',
          message: { text },
          ...fields
        })
      send('A', { messageKey: 'a:A', nativeMessageId: 'native-A' })
      const a = turn.currentAssistantMessageId!
      send('B', { messageKey: 'a:B', nativeMessageId: 'native-B' })
      const b = turn.currentAssistantMessageId!
      expect(() =>
        send('+late', { messageKey: 'a:A', nativeMessageId: 'native-late' })
      ).not.toThrow()
      send('child', { messageKey: 'a:A', nativeMessageId: 'native-child', parentToolRunId: 'task' })
      writer.persist(turn, {
        type: 'message.reasoning',
        text: 'separate session',
        sessionId: 's2',
        messageKey: 'a:A',
        nativeMessageId: 'native-foreign'
      })
      writer.persist(turn, {
        type: 'message.reasoning',
        text: 'no native id',
        sessionId: 's1',
        messageKey: 'a:A',
        nativeMessageId: ''
      })
      const lookup = vi.spyOn(db, 'findMessageByKey')
      send('+same', { messageKey: 'a:B' })
      expect(() => send('+legacy')).not.toThrow()
      expect(lookup).not.toHaveBeenCalled()
      expect(a).not.toBe(b)
      expect(turn.currentAssistantMessageId).toBe(b)
      expect(turn.assistantText).toBe('B+same+legacy')
      expect(db.getSessionById('s1')?.last_message_preview).toBe('+legacy')
      expect(db.nativeHistory.messageBindings(a)).toEqual(['native-A', 'native-late'])
      expect(db.nativeHistory.messageBindings(b)).toEqual(['native-B'])
      expect(
        connection.prepare('SELECT content, complete FROM messages ORDER BY idx').all()
      ).toEqual([
        { content: 'A+late', complete: 1 },
        { content: '', complete: 0 }
      ])
    } finally {
      connection.close()
    }
  })

  it('uses the current native binding fallback only when a direct writer event has an addressable row', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const bind = vi.spyOn(db.nativeHistory, 'bind')
      const nativeEcho: NormalizedEvent = {
        type: 'input.echo',
        sessionId: 's1',
        text: 'echo',
        nativeMessageId: 'native-echo'
      }
      expect(() => writer.persist(turn, nativeEcho)).not.toThrow()
      expect(bind).not.toHaveBeenCalled()
      writer.persist(turn, { type: 'message.reasoning', sessionId: 's1', text: 'active' })
      writer.persist(turn, nativeEcho)
      expect(bind.mock.calls).toEqual([[turn.currentAssistantMessageId, 'native-echo']])
    } finally {
      connection.close()
    }
  })

  it('w7 ignores an answer without a session or owner and keeps a keyed first answer separate from legacy replies', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const detached = makeTurn()
      detached.dbSessionId = null
      const answer = (id: string, messageKey?: string): TurnAskAnswer => ({
        toolUseId: id,
        output: id,
        messageKey
      })
      const insert = vi.spyOn(db, 'upsertToolResultPartInSession')
      expect(() =>
        writer.recordAskAnswers(detached, [answer('missing-session', 'a:A')])
      ).not.toThrow()
      writer.recordAskAnswers(turn, [answer('missing-owner')])
      expect(insert).not.toHaveBeenCalled()
      writer.recordAskAnswers(turn, [answer('first', 'a:A'), answer('legacy')])
      const a = turn.currentAssistantMessageId!
      writer.recordAskAnswers(turn, [answer('new', 'a:B')])
      const b = turn.currentAssistantMessageId!
      writer.recordAskAnswers(turn, [answer('late', 'a:A')])
      expect(b).not.toBe(a)
      expect(turn.currentAssistantMessageId).toBe(b)
      expect(insert.mock.calls.map(([session, owner, tool]) => [session, owner, tool])).toEqual([
        ['s1', a, 'first'],
        ['s1', a, 'legacy'],
        ['s1', b, 'new'],
        ['s1', a, 'late']
      ])
    } finally {
      connection.close()
    }
  })

  it('w4 keeps an open response after an unrelated keyed end and clears it after a matching end', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      writer.persist(turn, {
        type: 'response.boundary',
        sessionId: 's1',
        messageKey: 'a:A',
        boundary: { phase: 'begin', id: 'original' }
      })
      const original = turn.currentAssistantMessageId!
      writer.persist(turn, {
        type: 'response.boundary',
        sessionId: 's1',
        messageKey: 'a:B',
        boundary: { phase: 'end', id: 'other', outcome: 'ended' }
      })
      const b = turn.currentAssistantMessageId!
      expect(b).not.toBe(original)
      expect(turn.responseBoundary?.id).toBe('original')
      writer.persist(turn, {
        type: 'response.boundary',
        sessionId: 's1',
        boundary: { phase: 'end', id: 'missing', outcome: 'ended' }
      })
      writer.persist(turn, {
        type: 'response.boundary',
        sessionId: 's1',
        boundary: { phase: 'end', id: 'original', outcome: 'ended' }
      })
      expect(turn.responseBoundary).toBeUndefined()
      expect(
        db.loadParts('s1').map((row) => [row.message_id, JSON.parse(row.payload_json).boundary.id])
      ).toEqual([
        [original, 'original'],
        [b, 'other'],
        [b, 'original']
      ])
    } finally {
      connection.close()
    }
  })

  it('w1~w4 handle unkeyed events, new keyed rows, late owner-keyed tool result, and all 8 keyed cases', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const t = makeTurn('s1')
      // w1: unkeyed events work as before
      writer.persist(t, {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: 'unkeyed' }
      })
      // w2: new key closes previous row and creates a new row
      writer.persist(t, {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 'tool-a',
        toolName: 'Bash',
        args: {},
        messageKey: 'a:A'
      })
      writer.persist(t, {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: 'B text' },
        messageKey: 'a:B'
      })
      expect(
        connection.prepare('SELECT message_key, complete, content FROM messages ORDER BY idx').all()
      ).toEqual([
        { message_key: null, complete: 1, content: 'unkeyed' },
        { message_key: 'a:A', complete: 1, content: '' },
        { message_key: 'a:B', complete: 0, content: '' }
      ])
      const rowB = t.currentAssistantMessageId
      // w3: late A tool result attaches to A row; row count unchanged; current row stays B
      writer.persist(t, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'tool-a',
        result: 'late A',
        isError: false,
        messageKey: 'a:A'
      })
      expect(t.currentAssistantMessageId).toBe(rowB)
      const loaded = loadSession(db, 's1', () => '/tmp')!
      expect(loaded.messages).toHaveLength(3)
      expect(loaded.messages[1].id).toBe('a:A')
      expect(
        loaded.messages[1].parts.some((p) => p.type === 'tool_result' && p.toolRunId === 'tool-a')
      ).toBe(true)

      // w4: all 8 event kinds persist message_key
      const kinds: Array<[string, NormalizedEvent]> = [
        [
          'a:k1',
          { type: 'message.completed', sessionId: 's1', message: { text: 't' }, messageKey: 'a:k1' }
        ],
        ['a:k2', { type: 'message.reasoning', sessionId: 's1', text: 'r', messageKey: 'a:k2' }],
        [
          'a:k3',
          {
            type: 'tool.call.started',
            sessionId: 's1',
            toolRunId: 'c3',
            toolName: 'Read',
            args: {},
            messageKey: 'a:k3'
          }
        ],
        [
          'a:k4',
          {
            type: 'tool.call.completed',
            sessionId: 's1',
            toolRunId: 'c4',
            result: 'ok',
            isError: false,
            messageKey: 'a:k4'
          }
        ],
        [
          'a:k5',
          {
            type: 'response.boundary',
            sessionId: 's1',
            boundary: { id: 'rb', phase: 'begin', kind: 'work' },
            messageKey: 'a:k5'
          } as NormalizedEvent
        ],
        [
          'a:k6',
          {
            type: 'subagent.task',
            sessionId: 's1',
            toolUseId: 'sub6',
            phase: 'settled',
            background: true,
            status: 'completed',
            messageKey: 'a:k6'
          } as NormalizedEvent
        ],
        [
          'a:k7',
          {
            type: 'session.compacted',
            sessionId: 's1',
            trigger: 'auto',
            preTokens: 1,
            messageKey: 'a:k7'
          } as NormalizedEvent
        ],
        [
          'a:k8',
          {
            type: 'error',
            sessionId: 's1',
            error: { category: 'stream_error', message: 'e', retryable: false },
            messageKey: 'a:k8'
          }
        ]
      ]
      for (const [key, ev] of kinds) {
        writer.persist(t, ev)
        expect(db.findMessageByKey('s1', key)?.role).toBe('assistant')
      }
      writer.persist(t, {
        type: 'response.boundary',
        sessionId: 's1',
        messageKey: 'a:k5',
        boundary: { id: 'rb', phase: 'end', outcome: 'ended' }
      })
      const written = loadSession(db, 's1', () => '/tmp')!.messages
      expect(
        written.filter((m) => m.id.startsWith('a:k')).map((m) => [m.id, m.parts.map((p) => p.type)])
      ).toEqual([
        ['a:k1', ['text']],
        ['a:k2', ['reasoning']],
        ['a:k3', ['tool_call']],
        ['a:k4', ['tool_result']],
        ['a:k5', ['response_boundary', 'response_boundary']],
        ['a:k6', ['subagent_notice']],
        ['a:k7', ['compact_boundary']],
        ['a:k8', ['error']]
      ])
      expect(written.find((m) => m.id === 'a:k5')?.parts.at(-1)).toMatchObject({
        boundary: { id: 'rb', phase: 'end' }
      })
    } finally {
      connection.close()
    }
  })

  it('w10/w11 stores attachment and requirement payloads in their respective SQLite slots', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    const t = makeTurn('s1')
    const attachment = {
      id: 'f',
      kind: 'image' as const,
      name: 'image.png',
      mimeType: 'image/png',
      size: 2,
      path: '/image.png'
    }
    const requirement: DiffRequirementAnchor = {
      sessionId: 's1',
      baselineCommit: 'abc123',
      filePath: 'app.ts',
      oldLine: null,
      newLine: 2,
      hunkHeader: '@@ -1 +1,2 @@',
      contextBefore: [],
      contextAfter: [],
      comment: 'change',
      createdAt: 1
    }
    const origin = { kind: 'automatic' } as const
    try {
      for (const withAttachment of [true, false]) {
        for (const withRequirement of [true, false]) {
          const attachmentViews = withAttachment ? [attachment] : []
          const requirements = withRequirement ? [requirement] : []
          const batch = {
            text: 'body',
            createdAt: 1,
            origin,
            attachmentViews,
            requirements,
            messageKey: `u:${withAttachment}-${withRequirement}`
          }
          const result = writer.commitUserMessage(t, batch)!
          const expected: [string, unknown][] = [['text', { text: 'body', origin }]]
          if (withAttachment) expected.push(['attachment', { attachments: [attachment] }])
          if (withRequirement) expected.push(['diff_requirements', { requirements: [requirement] }])
          expect(
            db
              .committedUserParts(result.id)
              .map((part) => [part.type, JSON.parse(part.payload_json)])
          ).toEqual(expected)
          expect(writer.commitUserMessage(t, batch)).toEqual({ id: result.id, created: false })
        }
      }
    } finally {
      connection.close()
    }
  })

  it('w5/w11 compares stored part types independently of JSON property order', () => {
    const { connection, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const batch = {
        text: 'original',
        origin: { kind: 'automatic' } as const,
        createdAt: 1,
        messageKey: 'u:part-shape'
      }
      const result = writer.commitUserMessage(turn, batch)!
      const update = connection.prepare(
        'UPDATE message_parts SET type = ?, payload_json = ? WHERE message_id = ?'
      )
      const json = JSON.stringify({ origin: batch.origin, text: batch.text })
      expect(update.run('text', json, result.id).changes).toBe(1)
      expect(writer.commitUserMessage(turn, batch)).toEqual({ id: result.id, created: false })
      expect(update.run('attachment', json, result.id).changes).toBe(1)
      const changes = connection.prepare('SELECT total_changes() AS count')
      const before = changes.get()
      expect(() => writer.commitUserMessage(turn, batch)).toThrow()
      expect(changes.get()).toEqual(before)
    } finally {
      connection.close()
    }
  })

  it('w12 rejects incompatible aliases even when another binding matches the replay', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const turn = makeTurn()
      const batch = { text: 'original', createdAt: 1, messageKey: 'u:aliases' }
      const result = writer.commitUserMessage(turn, { ...batch, nativeMessageId: 'native-A' })!
      db.nativeHistory.bind(result.id, 'native-B')
      const changes = connection.prepare('SELECT total_changes() AS count')
      const before = changes.get()
      for (const nativeMessageId of ['native-A', 'native-B']) {
        expect(() => writer.commitUserMessage(turn, { ...batch, nativeMessageId })).toThrow()
      }
      expect(writer.commitUserMessage(turn, batch)).toEqual({ id: result.id, created: false })
      expect(changes.get()).toEqual(before)
      expect(db.nativeHistory.messageBindings(result.id)).toEqual(['native-A', 'native-B'])
    } finally {
      connection.close()
    }
  })

  it('w5, w6, w9, w10, w11, w12 enforce idempotent user recommit, role mismatch throw, payload equality, and native binding', () => {
    const { connection, writer, makeTurn } = setupDb()
    try {
      const t = makeTurn('s1')
      const att1 = [
        {
          id: 'f1',
          kind: 'image' as const,
          name: 'a.png',
          mimeType: 'image/png',
          size: 10,
          path: '/a.png'
        }
      ]
      const att2 = [
        {
          id: 'f2',
          kind: 'image' as const,
          name: 'b.png',
          mimeType: 'image/png',
          size: 10,
          path: '/b.png'
        }
      ]
      const req1 = [
        { id: 'r1', filePath: 'a.ts', line: 1, comment: 'fix' }
      ] as unknown as NonNullable<Parameters<HistoryWriter['commitUserMessage']>[1]['requirements']>
      const req2 = [
        { id: 'r2', filePath: 'b.ts', line: 2, comment: 'other' }
      ] as unknown as NonNullable<Parameters<HistoryWriter['commitUserMessage']>[1]['requirements']>

      const u1 = writer.commitUserMessage(t, {
        text: 'hello',
        createdAt: 1,
        messageKey: 'u:same',
        attachmentViews: att1,
        requirements: req1
      })
      expect(u1).toEqual({ id: 1, created: true })

      // w6: assistant event with user messageKey throws
      expect(() =>
        writer.persist(t, {
          type: 'message.completed',
          sessionId: 's1',
          message: { text: 'bad' },
          messageKey: 'u:same'
        })
      ).toThrow()

      // Start an assistant row so w5 can verify it is not finalized on recommit
      writer.persist(t, {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: 'working' },
        messageKey: 'a:work'
      })
      const activeId = t.currentAssistantMessageId
      const writes = connection.prepare('SELECT total_changes() AS count')
      const beforeRecommit = writes.get()
      // w5: identical recommit returns created: false without finalizing current assistant row
      const recommit = writer.commitUserMessage(t, {
        text: 'hello',
        createdAt: 2,
        messageKey: 'u:same',
        attachmentViews: att1,
        requirements: req1
      })
      expect(recommit).toEqual({ id: u1!.id, created: false })
      expect(t.currentAssistantMessageId).toBe(activeId)

      // w9: user recommit with assistant messageKey throws
      expect(() =>
        writer.commitUserMessage(t, { text: 'working', createdAt: 3, messageKey: 'a:work' })
      ).toThrow()

      // w10: different text throws and leaves row unchanged
      expect(() =>
        writer.commitUserMessage(t, {
          text: 'changed',
          createdAt: 3,
          messageKey: 'u:same',
          attachmentViews: att1,
          requirements: req1
        })
      ).toThrow()

      // w11: same counts but different attachment or requirement payload throws
      expect(() =>
        writer.commitUserMessage(t, {
          text: 'hello',
          createdAt: 3,
          messageKey: 'u:same',
          attachmentViews: att2,
          requirements: req1
        })
      ).toThrow()
      expect(() =>
        writer.commitUserMessage(t, {
          text: 'hello',
          createdAt: 3,
          messageKey: 'u:same',
          attachmentViews: att1,
          requirements: req2
        })
      ).toThrow()

      expect(() =>
        writer.commitUserMessage(t, {
          text: 'hello',
          createdAt: 3,
          messageKey: 'u:same',
          attachmentViews: att1,
          requirements: req1,
          origin: { kind: 'scheduled' }
        })
      ).toThrow()
      expect(writes.get()).toEqual(beforeRecommit)

      // w12: adding native binding on recommit succeeds; conflicting native binding throws
      const bound = writer.commitUserMessage(t, {
        text: 'hello',
        createdAt: 4,
        messageKey: 'u:same',
        attachmentViews: att1,
        requirements: req1,
        nativeMessageId: 'nat-u1'
      })
      expect(bound).toEqual({ id: u1!.id, created: false })
      const afterBinding = writes.get()
      expect(
        writer.commitUserMessage(t, {
          text: 'hello',
          createdAt: 5,
          messageKey: 'u:same',
          attachmentViews: att1,
          requirements: req1,
          nativeMessageId: 'nat-u1'
        })
      ).toEqual(bound)
      expect(writes.get()).toEqual(afterBinding)

      expect(() =>
        writer.commitUserMessage(t, {
          text: 'hello',
          createdAt: 5,
          messageKey: 'u:same',
          attachmentViews: att1,
          requirements: req1,
          nativeMessageId: 'nat-other'
        })
      ).toThrow()
      expect(writes.get()).toEqual(afterBinding)
      const plain = { text: 'plain', createdAt: 6, messageKey: 'u:plain' }
      writer.commitUserMessage(t, plain)
      const beforeConflict = writes.get()
      expect(() => writer.commitUserMessage(t, { ...plain, attachmentViews: att1 })).toThrow()
      expect(writes.get()).toEqual(beforeConflict)
    } finally {
      connection.close()
    }
  })

  it('w7, w13, w14, w15 scope tool_result upsert to session and update existing result in place', () => {
    const { connection, db, writer, makeTurn } = setupDb()
    try {
      const t1 = makeTurn('s1')
      const t2 = makeTurn('s2')

      // w7: recordAskAnswers attaches to owner key row
      writer.persist(t1, {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 'ask-1',
        toolName: 'AskUserQuestion',
        args: {},
        messageKey: 'a:ask-row'
      })
      writer.persist(t1, {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: 'later' },
        messageKey: 'a:later'
      })
      writer.recordAskAnswers(t1, [
        { toolUseId: 'ask-1', output: { answers: { q: 'yes' } }, messageKey: 'a:ask-row' }
      ])
      const s1Loaded = loadSession(db, 's1', () => '/tmp')!
      expect(
        s1Loaded.messages
          .find((m) => m.id === 'a:ask-row')
          ?.parts.some((p) => p.type === 'tool_result' && p.toolRunId === 'ask-1')
      ).toBe(true)

      // w13: duplicate tool.call.completed updates in place without adding a second part
      writer.persist(t1, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'shared-tool',
        result: 'v1',
        isError: false,
        messageKey: 'a:ask-row'
      })
      writer.persist(t1, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'shared-tool',
        result: 'v2',
        isError: false,
        messageKey: 'a:ask-row'
      })
      const afterW13 = loadSession(db, 's1', () => '/tmp')!.messages.find(
        (m) => m.id === 'a:ask-row'
      )!
      const sharedParts = afterW13.parts.filter(
        (p) => p.type === 'tool_result' && p.toolRunId === 'shared-tool'
      )
      expect(sharedParts).toHaveLength(1)
      expect((sharedParts[0] as { result: unknown }).result).toBe('v2')

      // w14: session s2 with the same toolRunId must NOT overwrite session s1
      writer.persist(t2, {
        type: 'tool.call.started',
        sessionId: 's2',
        toolRunId: 'shared-tool',
        toolName: 'Bash',
        args: {},
        messageKey: 'a:s2-row'
      })
      writer.persist(t2, {
        type: 'tool.call.completed',
        sessionId: 's2',
        toolRunId: 'shared-tool',
        result: 's2-result',
        isError: false,
        messageKey: 'a:s2-row'
      })
      writer.recordAskAnswers(t2, [
        { toolUseId: 'ask-1', output: { answers: { q: 's2-no' } }, messageKey: 'a:s2-row' }
      ])
      const s1Check = loadSession(db, 's1', () => '/tmp')!.messages.find(
        (m) => m.id === 'a:ask-row'
      )!
      expect(
        (
          s1Check.parts.find((p) => p.type === 'tool_result' && p.toolRunId === 'shared-tool') as {
            result: unknown
          }
        ).result
      ).toBe('v2')
      expect(
        (
          s1Check.parts.find((p) => p.type === 'tool_result' && p.toolRunId === 'ask-1') as {
            result: unknown
          }
        ).result
      ).toEqual({ answers: { q: 'yes' } })

      // w15: within the same session, updating toolRunId that already exists on an earlier row updates that row (no duplicate)
      writer.persist(t1, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'shared-tool',
        result: 'v3-updated-earlier',
        isError: false,
        messageKey: 'a:later'
      })
      const s1Final = loadSession(db, 's1', () => '/tmp')!
      const allShared = s1Final.messages.flatMap((m) =>
        m.parts.filter((p) => p.type === 'tool_result' && p.toolRunId === 'shared-tool')
      )
      expect(allShared).toHaveLength(1)
      expect((allShared[0] as { result: unknown }).result).toBe('v3-updated-earlier')
    } finally {
      connection.close()
    }
  })
})
