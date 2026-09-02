import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'

// writer → infra/ipc/send → electron(webContents) 런타임 체인을 절단 — 이 스위트는
// electron 바이너리 없이도 돈다(hermetic, 0104 선례). 테스트는 send 를 호출하지 않는다.
vi.mock('electron', () => ({
  webContents: { getAllWebContents: (): unknown[] => [] }
}))

import { HistoryWriter } from './writer'
import { DbQueries } from '../../infra/db/queries'
import type { AttachmentView, NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { applyMigrations } from '../../infra/db/migrate'

// persistUserMessage 만 검증 — appendMessage/appendPart 만 모의한다.
function makePersistence(): {
  persistence: HistoryWriter
  appendMessage: ReturnType<typeof vi.fn>
  appendPart: ReturnType<typeof vi.fn>
} {
  const appendMessage = vi.fn(() => 7)
  const appendPart = vi.fn(() => 0)
  const db = { appendMessage, appendPart } as unknown as DbQueries
  const persistence = new HistoryWriter(db)
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

describe('HistoryWriter.persistUserMessage — 첨부 영속', () => {
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
    const persistence = new HistoryWriter(db as unknown as DbQueries)
    const turn = {
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
        baselineOid: 'a'.repeat(40),
        baselineRef: 'main'
      })
    )
  })

  it('resumed session.updated cannot replace the birth baseline in the database', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const queries = new DbQueries(db)
    const persistence = new HistoryWriter(queries)
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
    expect(queries.getSessionBaseline('persisted-session')).toEqual({
      oid: 'a'.repeat(40),
      ref: 'main'
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
  const persistence = new HistoryWriter(db as unknown as DbQueries)
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
    const persistence = new HistoryWriter(db as unknown as DbQueries)
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
