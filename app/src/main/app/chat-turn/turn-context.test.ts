// 0179 — TurnContext 조립 회귀. continuity(fork/handoff)가 더하는 넷이 **항상 함께** 가는지가
// 요점이다: 출발 세션 cwd 계승 · lineage · initialTitle 마커 · titleGenerationStarted.
// 하나라도 빠지면 분기 세션이 원본 컨텍스트를 잃거나(cwd) 마커 제목이 자동 제목에 덮인다.

import { describe, expect, it } from 'vitest'
import { buildTurnContext, makeContinuationTurn, resolveTurnCwd } from './turn-context'
import type { SessionControl } from '../../features/sessions/session-chain-lease'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'

const control: SessionControl = {
  taskIds: new Map(),
  subagentTypes: new Map(),
  stoppedSubagents: new Set(),
  blockedSubagents: new Set(),
  cancelled: false
}

const titleAdapter = { id: 'claude', complete: async () => '' } as unknown as RuntimeTitleAdapter

// 이 턴의 spawn 입력 한 벌. `send.ts` 는 `prepared.providerSettings` 와 `prepared.env` 를
// **함께** 넘긴다 — 여기서도 둘을 갈라 두지 않는다.
const preparedSettings: ResolvedHarnessSettings = {
  providerKey: 'claude-anthropic',
  provider: 'anthropic',
  settings: { model: 'sonnet' },
  sourceRevision: '/sources/settings/claude/anthropic/settings.json@7'
}

function base(): Parameters<typeof buildTurnContext<string>>[0] {
  return {
    controller: new AbortController(),
    owner: 'window-1',
    control,
    titleAdapter,
    titleSettings: preparedSettings,
    titleEnv: { FOO: 'bar' },
    resolved: { providerKey: 'claude-anthropic', titleModel: 'haiku' },
    payload: { sessionId: null, cwd: null, attachmentViews: [] },
    effectiveText: '안녕',
    boundProjectId: null,
    sessionMeta: undefined,
    continuityMeta: undefined,
    continuityLang: 'ko',
    queueKey: 'q-1',
    getCwd: () => '/workspace/default'
  }
}

describe('buildTurnContext', () => {
  it('일반 send 는 continuity 필드를 비우고 cwd 를 해석한다', () => {
    const turn = buildTurnContext<string>(base())

    expect(turn.lineage).toBeUndefined()
    expect(turn.initialTitle).toBeUndefined()
    expect(turn.titleGenerationStarted).toBe(false)
    expect(turn.cwd).toBe('/workspace/default')
    expect(turn.isNewSession).toBe(true)
    expect(turn.queueKey).toBe('q-1')
    expect(turn.pendingUserText).toBe('안녕')
    expect(turn.firstUserText).toBe('안녕')
  })

  // ── r10 회귀 ─────────────────────────────────────────────────────────────
  //
  // 0188 이 `ResolvedTurnProvider` 에서 `providerSettings` 를 떼어내면서, 이 조립부에 남아 있던
  // `resolved.providerSettings?` 가 아무도 채우지 않는 죽은 optional 이 됐다 — 구조적 타이핑이라
  // typecheck 가 잡지 못했고 `titleSettings` 는 **항상 undefined** 였다. 제목 생성이
  // `options.settings` 없이 돌았다는 뜻이고, app env·settings env 가 없는 정적 배포에서는
  // env 까지 없이 돌았다. 두 채널이 **함께** 실리는지 단언한다(D-019).
  it('제목 생성은 이 턴의 settings 와 env 를 함께 받는다', () => {
    const turn = buildTurnContext<string>(base())

    expect(turn.titleSettings).toBe(preparedSettings)
    expect(turn.titleEnv).toEqual({ FOO: 'bar' })
    expect(turn.titleModel).toBe('haiku')
  })

  // 해석이 없는 턴에서 한쪽만 남으면 다시 비대칭이다 — 둘 다 비어야 한다.
  it('spawn 입력이 없는 턴은 두 채널 모두 비운다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      titleSettings: undefined,
      titleEnv: undefined
    })

    expect(turn.titleSettings).toBeUndefined()
    expect(turn.titleEnv).toBeUndefined()
  })

  it('fork 는 lineage·마커 제목·자동제목 억제·출발 세션 cwd 계승을 함께 채운다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, attachmentViews: [], forkFrom: 'src-session' },
      continuityMeta: { title: '원본 대화', cwd: '/workspace/origin', project_id: 'p-1' }
    })

    expect(turn.lineage).toEqual({ parentSessionId: 'src-session', relation: 'fork' })
    expect(turn.initialTitle).toContain('원본 대화')
    expect(turn.titleGenerationStarted).toBe(true)
    expect(turn.cwd).toBe('/workspace/origin')
  })

  it('handoff 는 relation 만 다르고 나머지 셋은 fork 와 같다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, attachmentViews: [], handoffFrom: 'src-session' },
      continuityMeta: { title: null, cwd: null, project_id: null }
    })

    expect(turn.lineage).toEqual({ parentSessionId: 'src-session', relation: 'handoff' })
    // 원본 제목이 없으면 id 앞 8자로 폴백한다.
    expect(turn.initialTitle).toContain('src-sess')
    expect(turn.titleGenerationStarted).toBe(true)
    // continuityMeta.cwd 가 null 이면 프로젝트 파생으로 넘어간다.
    expect(turn.cwd).toBe('/workspace/default')
  })
})

describe('resolveTurnCwd', () => {
  it('resume 은 세션행의 cwd 를 쓰고, 없으면 프로젝트 파생으로 넘어간다', () => {
    expect(
      resolveTurnCwd(
        { sessionId: 's-1', projectId: null },
        { cwd: '/session/cwd', project_id: 'p-1' },
        () => '/derived'
      )
    ).toBe('/session/cwd')
    expect(
      resolveTurnCwd(
        { sessionId: 's-1', projectId: null },
        { cwd: null, project_id: 'p-1' },
        () => '/derived'
      )
    ).toBe('/derived')
  })

  it('새 채팅은 요청 cwd 를 우선하고 없으면 프로젝트 파생을 쓴다', () => {
    expect(
      resolveTurnCwd(
        { sessionId: null, projectId: 'p-1', cwd: '/explicit' },
        undefined,
        () => '/derived'
      )
    ).toBe('/explicit')
    expect(resolveTurnCwd({ sessionId: null, projectId: 'p-1' }, undefined, () => '/derived')).toBe(
      '/derived'
    )
  })
})

describe('makeContinuationTurn', () => {
  it('세션 메타는 계승하고 턴-로컬 상태는 초기화한다', () => {
    const prev = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: 's-1', cwd: null, attachmentViews: [] }
    })
    prev.assistantText = '이전 답변'
    prev.currentAssistantMessageId = 42
    prev.askPendingIds.push('ask-1')
    prev.subagentTaskIds.set('tool-1', 'task-1')

    const next = makeContinuationTurn(prev)

    // 계승
    expect(next.dbSessionId).toBe('s-1')
    expect(next.cwd).toBe(prev.cwd)
    expect(next.providerKey).toBe(prev.providerKey)
    expect(next.firstUserText).toBe(prev.firstUserText)
    expect(next.subagentTaskIds.get('tool-1')).toBe('task-1')
    // 초기화
    expect(next.assistantText).toBe('')
    expect(next.currentAssistantMessageId).toBeNull()
    expect(next.askPendingIds).toEqual([])
    expect(next.pendingUserText).toBeNull()
    expect(next.isNewSession).toBe(false)
    expect(next.controller).not.toBe(prev.controller)
  })
})

// 추가 참조 경로(CLI `/add-dir`) — cwd 와 **같은 규칙**이라는 것이 요점이다. 새 채팅은 요청값을,
// resume 은 세션행을, continuity 는 출발 세션을 따른다. 규칙이 갈라지면 도착/재개 세션이 참조
// 경로를 잃고 workspace 가드가 그 경로를 막는다.
describe('extraDirs 해석', () => {
  it('새 채팅은 요청값을 그대로 쓴다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, extraDirs: ['/refs/a'], attachmentViews: [] }
    })
    expect(turn.extraDirs).toEqual(['/refs/a'])
  })

  it('요청값이 없으면 빈 배열이다', () => {
    expect(buildTurnContext<string>(base()).extraDirs).toEqual([])
  })

  it('resume 은 세션행 값이 요청값을 이긴다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: 's1', cwd: null, extraDirs: ['/ignored'], attachmentViews: [] },
      sessionMeta: { cwd: '/w', project_id: null, extra_dirs: '["/refs/persisted"]' }
    })
    expect(turn.extraDirs).toEqual(['/refs/persisted'])
  })

  it('손상된 세션행 값은 없음으로 접는다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: 's1', cwd: null, attachmentViews: [] },
      sessionMeta: { cwd: '/w', project_id: null, extra_dirs: 'not-json' }
    })
    expect(turn.extraDirs).toEqual([])
  })

  it('continuity 는 출발 세션의 참조 경로를 계승한다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, forkFrom: 'src-1', attachmentViews: [] },
      continuityMeta: {
        title: '원본',
        cwd: '/origin',
        project_id: null,
        extra_dirs: '["/refs/origin"]'
      }
    })
    expect(turn.extraDirs).toEqual(['/refs/origin'])
  })

  it('자동 연속 턴은 직전 턴의 참조 경로를 그대로 잇는다', () => {
    const prev = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, extraDirs: ['/refs/a'], attachmentViews: [] }
    })
    expect(makeContinuationTurn(prev).extraDirs).toEqual(['/refs/a'])
  })

  // 세 번째 강제 지점 — 세션행은 IPC 스키마를 다시 타지 않는다. 절대경로 검증이 없던 시절에
  // 쓰인 행이 resume 으로 되살아나면 그 값이 SDK 옵션 `additionalDirectories` 까지 흘러간다.
  it('세션행의 상대 경로는 버린다 — 스키마 이전에 쓰인 행이 되살아나지 않는다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: 's1', cwd: null, attachmentViews: [] },
      sessionMeta: { cwd: '/w', project_id: null, extra_dirs: '["refs","../up","/refs/ok"]' }
    })
    expect(turn.extraDirs).toEqual(['/refs/ok'])
  })

  it('continuity 계승도 같은 규칙을 받는다', () => {
    const turn = buildTurnContext<string>({
      ...base(),
      payload: { sessionId: null, cwd: null, forkFrom: 'src-1', attachmentViews: [] },
      continuityMeta: {
        title: '원본',
        cwd: '/origin',
        project_id: null,
        extra_dirs: '["relative/x","/refs/origin"]'
      }
    })
    expect(turn.extraDirs).toEqual(['/refs/origin'])
  })
})
