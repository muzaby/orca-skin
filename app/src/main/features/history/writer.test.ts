import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// writer → infra/ipc/send → electron(webContents) 런타임 체인을 절단 — 이 스위트는
// electron 바이너리 없이도 돈다(hermetic, 0104 선례). 테스트는 send 를 호출하지 않는다.
vi.mock('electron', () => ({
  webContents: { getAllWebContents: (): unknown[] => [] }
}))

import { HistoryWriter } from './writer'
import { DbQueries } from '../../infra/db/queries'
import type { AttachmentView, DiffRequirementAnchor, NormalizedEvent } from '../../../shared/ipc'
import { partFromRow } from '../../infra/ipc/dto'
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
    const directory = mkdtempSync(join(tmpdir(), 'orca-response-boundary-'))
    const filename = join(directory, 'history.db')
    let connection = new Database(filename)
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
      expect(loadSession(queries, 'fork', () => '/fallback')?.messages).toEqual(expected?.messages)
      connection.close()
      connection = new Database(filename)
      const reopened = new DbQueries(connection)
      expect(loadSession(reopened, 's1', () => '/fallback')).toEqual(expected)
      expect(loadSession(reopened, 'fork', () => '/fallback')?.messages).toEqual(expected?.messages)
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
      updateSessionProviderKey: vi.fn()
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
    updateSessionProviderKey: vi.fn()
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
    upsertToolResultPart: ReturnType<typeof vi.fn>
    turn: TurnContext
  } {
    const upsertToolResultPart = vi.fn()
    const db = {
      appendMessage: vi.fn(() => 7),
      appendPart: vi.fn(() => 0),
      upsertToolResultPart,
      updateSessionPreview: vi.fn(),
      updateSessionProviderKey: vi.fn()
    }
    const persistence = new HistoryWriter(db as unknown as DbQueries, () => false)
    const turn = {
      dbSessionId: 's1',
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null,
      askResolved: new Map()
    } as unknown as TurnContext
    return { persistence, upsertToolResultPart, turn }
  }

  it('structuredOutput 을 tool_result payload 에 싣는다', () => {
    const { persistence, upsertToolResultPart, turn } = harness()
    const structured = { task: { id: '3', subject: '테스트 작성' } }
    persistence.persist(turn, {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 't1',
      result: 'ok',
      isError: false,
      structuredOutput: structured
    } as NormalizedEvent)

    const payload = JSON.parse(upsertToolResultPart.mock.calls[0][2] as string) as {
      structuredOutput?: unknown
    }
    expect(payload.structuredOutput).toEqual(structured)
  })

  it('없으면 키를 만들지 않는다 — 일반 도구 결과는 그대로다', () => {
    const { persistence, upsertToolResultPart, turn } = harness()
    persistence.persist(turn, {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 't1',
      result: 'ok',
      isError: false
    } as NormalizedEvent)

    const payload = JSON.parse(upsertToolResultPart.mock.calls[0][2] as string) as Record<
      string,
      unknown
    >
    expect('structuredOutput' in payload).toBe(false)
  })
})
