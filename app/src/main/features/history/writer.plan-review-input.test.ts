import { afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import type { AppMessagePart, NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { partFromRow } from '../../infra/ipc/dto'

vi.mock('electron', () => ({ webContents: { getAllWebContents: (): unknown[] => [] } }))

import { HistoryWriter } from './writer'

const connections: Database.Database[] = []
afterEach(() => {
  for (const db of connections.splice(0)) db.close()
})

type Started = Extract<NormalizedEvent, { type: 'tool.call.started' }>
type Permission = Extract<NormalizedEvent, { type: 'permission.requested' }>

function started(id = 'plan-1', sessionId = 's1', extra: Partial<Started> = {}): Started {
  return {
    type: 'tool.call.started',
    sessionId,
    toolRunId: id,
    toolName: 'ExitPlanMode',
    args: { allowedPrompts: [{ tool: 'Bash', prompt: 'run tests' }] },
    ...extra
  }
}

const corrected = {
  allowedPrompts: [{ tool: 'Bash', prompt: 'run tests' }],
  plan: '# Reviewed plan',
  planFilePath: 'C:/plans/current.md',
  extra: { preserved: true }
}

function permission(
  id = 'plan-1',
  input: unknown = corrected,
  sessionId: string | undefined = 's1',
  agentId?: string
): Permission {
  return {
    type: 'permission.requested',
    ...(sessionId !== undefined ? { sessionId } : {}),
    approvalId: `approval-${id}`,
    origin: 'agent',
    action: {
      kind: 'plan_review',
      request: { requestId: `approval-${id}`, plan: '# Reviewed plan' },
      input,
      providerRequest: {
        requestId: `request-${id}`,
        toolUseId: id,
        ...(agentId !== undefined ? { agentId } : {})
      }
    }
  }
}

function fixture(sessionId: string | null = 's1'): {
  writer: HistoryWriter
  queries: DbQueries
  turn: TurnContext
} {
  const db = new Database(':memory:')
  connections.push(db)
  applyMigrations(db)
  const queries = new DbQueries(db)
  for (const id of ['s1', 's2'])
    queries.insertSession({
      id,
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1,
      agentKind: 'code'
    })
  return {
    queries,
    writer: new HistoryWriter(queries, () => false),
    turn: {
      agentKind: 'code',
      dbSessionId: sessionId,
      currentAssistantMessageId: null,
      assistantText: '',
      providerKey: null,
      titleAdapter: { id: 'claude' },
      pendingProjectId: null,
      cwd: '/work',
      extraDirs: [],
      sessionBaseline: null,
      sessionBaselineRef: null,
      pendingUserText: null,
      askResolved: new Map()
    } as unknown as TurnContext
  }
}

function parts(queries: DbQueries, sessionId = 's1'): AppMessagePart[] {
  return queries.loadParts(sessionId).map(partFromRow)
}

describe('0249 ΔV3 — 계획 검토 입력의 영속과 늦은 호출', () => {
  it('started 선행이면 기존 호출 args만 갱신하고 결과·메타·순서를 보존한다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, started('neighbor'))
    writer.persist(turn, started())
    writer.persist(turn, {
      type: 'tool.call.completed',
      sessionId: 's1',
      toolRunId: 'plan-1',
      result: { plan: 'SDK result', filePath: 'C:/plans/result.md' },
      isError: false,
      durationMs: 42
    })
    const before = queries.loadParts('s1')
    writer.persist(turn, permission())
    const after = queries.loadParts('s1')
    expect(after.map((row) => [row.tool_run_id, row.type])).toEqual(
      before.map((row) => [row.tool_run_id, row.type])
    )
    expect(after[0]).toEqual(before[0])
    expect(after[2]).toEqual(before[2])
    expect(parts(queries)[1]).toEqual({
      type: 'tool_call',
      toolRunId: 'plan-1',
      toolName: 'ExitPlanMode',
      args: corrected
    })
  })

  it('permission 선행 후 telemetry·승인 해소가 와도 늦은 started를 relay 전에 보정한다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, permission())
    writer.persist(turn, {
      type: 'permission.resolved',
      sessionId: 's1',
      approvalId: 'approval-plan-1',
      resolution: { behavior: 'deny' }
    })
    writer.persist(turn, { type: 'telemetry', sessionId: 's1' })
    const event = started()
    writer.persist(turn, event)
    expect(event.args).toBe(corrected)
    expect(parts(queries)[0]).toMatchObject({ args: corrected })
    expect(parts(queries)).toHaveLength(1)
  })

  it('새 승인 요청의 최신 값으로 다시 교정하고 다른 호출에는 적용하지 않는다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, started())
    writer.persist(turn, permission())
    const latest = { ...corrected, plan: '# After another Write', planFilePath: 'C:/plans/new.md' }
    writer.persist(turn, permission('plan-1', latest))
    const second = started('plan-2')
    const original = second.args
    writer.persist(turn, second)
    expect(parts(queries)[0]).toMatchObject({ args: latest })
    expect(second.args).toBe(original)
    expect(parts(queries)[1]).toMatchObject({ args: original })
  })

  it('정상 입력의 참조를 보존하고 동일 요청 재전달은 파트를 추가하지 않는다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, permission())
    writer.persist(turn, permission())
    const event = started('plan-1', 's1', { args: corrected })
    writer.persist(turn, event)
    expect(event.args).toBe(corrected)
    expect(parts(queries)).toHaveLength(1)
  })

  it('세션 미확정 started 두 건과 그 뒤 승인을 세션 확정 후 원래 순서로 저장한다', () => {
    const { writer, queries, turn } = fixture(null)
    writer.persist(turn, started('neighbor', ''))
    writer.persist(turn, started('plan-1', ''))
    writer.persist(turn, permission('plan-1', corrected, undefined))
    expect(parts(queries)).toHaveLength(0)
    writer.persist(turn, { type: 'session.updated', sessionId: 's1', patch: {} })
    expect(
      parts(queries).map((part) => ('toolRunId' in part ? part.toolRunId : undefined))
    ).toEqual(['neighbor', 'plan-1'])
    expect(parts(queries)[1]).toMatchObject({ args: corrected })
    expect(turn.pendingPlanToolCalls).toBeUndefined()
  })

  it('세션 미확정 permission을 이후 늦은 started에 적용하되 다른 owner는 제외한다', () => {
    const { writer, queries, turn } = fixture(null)
    writer.persist(turn, permission('plan-1', corrected, 's2'))
    writer.persist(turn, { type: 'session.updated', sessionId: 's1', patch: {} })
    const event = started()
    const original = event.args
    writer.persist(turn, event)
    expect(event.args).toBe(original)
    expect(parts(queries)[0]).toMatchObject({ args: original })
  })

  it('다른 세션 permission은 Map·저장된 호출을 교정하지 않는다', () => {
    const { writer, queries, turn } = fixture()
    const event = started()
    writer.persist(turn, event)
    writer.persist(turn, permission('plan-1', corrected, 's2'))
    expect(turn.planToolInputs).toBeUndefined()
    expect(parts(queries)[0]).toMatchObject({ args: event.args })
  })

  it.each(['child', 'no identity', 'array input', 'other approval'])(
    '%s 승인은 메인 계획 입력을 교정하지 않는다',
    (kind) => {
      const { writer, queries, turn } = fixture()
      const request = permission()
      if (request.action.kind !== 'plan_review') throw new Error('plan review required')
      if (kind === 'child') request.action.providerRequest!.agentId = 'child'
      if (kind === 'no identity') delete request.action.providerRequest
      if (kind === 'array input') request.action.input = []
      if (kind === 'other approval')
        request.action = { kind: 'tool_approval', toolName: 'Bash', input: corrected }
      const event = started()
      writer.persist(turn, event)
      writer.persist(turn, request)
      expect(turn.planToolInputs).toBeUndefined()
      expect(parts(queries)[0]).toMatchObject({ args: event.args })
    }
  )

  it('SQL은 같은 id의 다른 세션·다른 도구·child 입력과 parent/result를 보존한다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, started())
    writer.persist(turn, started('plan-1', 's1', { toolName: 'Bash', args: { command: 'keep' } }))
    writer.persist(
      turn,
      started('plan-1', 's1', { parentToolRunId: 'parent', args: { plan: 'child' } })
    )
    const other = { ...turn, dbSessionId: 's2', currentAssistantMessageId: null } as TurnContext
    writer.persist(other, started('plan-1', 's2', { args: { plan: 'other session' } }))
    const before = queries.loadParts('s1')
    const beforeOther = queries.loadParts('s2')
    writer.persist(turn, permission())
    const after = queries.loadParts('s1')
    expect(parts(queries)[0]).toMatchObject({ args: corrected })
    expect(after.slice(1)).toEqual(before.slice(1))
    expect(queries.loadParts('s2')).toEqual(beforeOther)
  })

  it('같은 세션의 이전 턴에서 같은 id를 써도 현재 턴의 호출만 교정한다', () => {
    const { writer, queries, turn: previous } = fixture()
    writer.persist(previous, started())
    writer.persist(previous, { type: 'telemetry', sessionId: 's1' })
    const current = { ...previous, currentAssistantMessageId: null } as TurnContext
    const oldRow = queries.loadParts('s1')[0]
    // callback-first는 기존 세션에 row가 있어도 이번 턴의 Map에만 보관한다.
    writer.persist(current, permission())
    expect(queries.loadParts('s1')[0]).toEqual(oldRow)
    writer.persist(current, started())
    const latest = { ...corrected, plan: '# Current turn' }
    writer.persist(current, permission('plan-1', latest))
    expect(queries.loadParts('s1')[0]).toEqual(oldRow)
    expect(parts(queries)[1]).toMatchObject({ args: latest })
  })

  it('DB API도 다른 sessionId와 현재 messageId의 조합을 거부한다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, started())
    const original = queries.loadParts('s1')
    queries.updateToolCallInput(
      's2',
      turn.currentAssistantMessageId!,
      'plan-1',
      'ExitPlanMode',
      corrected
    )
    expect(queries.loadParts('s1')).toEqual(original)
    queries.updateToolCallInput(
      's1',
      turn.currentAssistantMessageId!,
      'plan-1',
      'ExitPlanMode',
      corrected
    )
    expect(parts(queries)[0]).toMatchObject({ args: corrected })
  })

  it('DB 교정 실패는 history critical 오류로 전파한다', () => {
    const { writer, queries, turn } = fixture()
    writer.persist(turn, started())
    vi.spyOn(queries, 'updateToolCallInput').mockImplementation(() => {
      throw new Error('database write failed')
    })
    expect(() => writer.persist(turn, permission())).toThrow('database write failed')
  })
})
