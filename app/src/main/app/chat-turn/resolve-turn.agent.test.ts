import { afterEach, expect, it, vi } from 'vitest'
import { resolveTurn } from './resolve-turn'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { passthroughRuntimeConfig } from '../runtime-config.testfixture'
import { withDataPort } from '../data-host/data-port.testfixture'

vi.mock('../../features/chat/recovery', () => ({ recoverSessionHistory: vi.fn() }))
vi.mock('../../infra/config/oo-config', () => ({ appEnv: () => ({}) }))
afterEach(() => vi.clearAllMocks())

it.each(['sessionId', 'forkFrom', 'handoffFrom'] as const)(
  'rejects a changed source harness after provider preparation (%s)',
  async (sourceField) => {
    let source = { agent_kind: 'code', backend: 'opencode', project_id: null, cwd: '/workspace' }
    const ctx = withDataPort({
      ...passthroughRuntimeConfig(),
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      mcp: { resolver: () => () => undefined }
    })
    const pending = resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'opencode', agentSpawnEnv: () => ({}) } as never,
      {
        sessionId: null,
        [sourceField]: 'source',
        projectId: null,
        text: 'continue',
        agentKind: 'code'
      } as never
    )
    source = { ...source, backend: 'claude' }
    expect(await pending).toMatchObject({
      ok: false,
      error: { category: 'schema_validation_error' }
    })
    expect(recoverSessionHistory).not.toHaveBeenCalled()
  }
)

it.each(['sessionId', 'forkFrom', 'handoffFrom'] as const)(
  'rejects source deletion during asynchronous provider preparation (%s)',
  async (sourceField) => {
    const agentSpawnEnv = vi.fn(() => ({ SESSION_KIND: 'work' }))
    let source: Record<string, unknown> | undefined = {
      agent_kind: 'work',
      backend: 'claude',
      title: 'source',
      project_id: null,
      cwd: '/workspace'
    }
    const ctx = withDataPort({
      ...passthroughRuntimeConfig(),
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      settings: { getAll: () => ({ language: 'ko' }) },
      mcp: { resolver: () => () => undefined }
    })
    const pending = resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'claude', agentSpawnEnv } as never,
      {
        sessionId: null,
        projectId: null,
        text: 'continue',
        agentKind: 'work',
        [sourceField]: 'source'
      } as never
    )
    source = undefined
    expect(await pending).toMatchObject({
      ok: false,
      error: { category: 'schema_validation_error' }
    })
    expect(recoverSessionHistory).not.toHaveBeenCalled()
    expect(agentSpawnEnv).toHaveBeenCalledOnce()
    expect(agentSpawnEnv).toHaveBeenCalledWith('work')
  }
)

it.each(['code', 'corrupt'])(
  'rejects source kind changes during preparation (%s)',
  async (agentKind) => {
    const agentSpawnEnv = vi.fn(() => ({}))
    let source = { agent_kind: 'work', backend: 'claude', project_id: null, cwd: '/workspace' }
    const ctx = withDataPort({
      ...passthroughRuntimeConfig(),
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      mcp: { resolver: () => () => undefined }
    })
    const pending = resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'claude', agentSpawnEnv } as never,
      { sessionId: 'source', projectId: null, text: 'continue', agentKind: 'work' } as never
    )
    source = { ...source, agent_kind: agentKind }
    expect(await pending).toMatchObject({
      ok: false,
      error: { category: 'schema_validation_error' }
    })
    expect(recoverSessionHistory).not.toHaveBeenCalled()
    expect(agentSpawnEnv).toHaveBeenCalledWith('work')
  }
)

// 0324 EP-17 — 연속성 산출물 언어는 실행 쪽 설정 사본(`ctx.settings`)의 언어에서 온다(payload 에 없을 때).
it.each([
  ['forkFrom', 'English', 'en'],
  ['handoffFrom', 'English', 'en'],
  ['forkFrom', '한국어', 'ko']
] as const)(
  'continuity language follows the settings copy for %s (%s → %s)',
  async (sourceField, language, expected) => {
    const source = {
      agent_kind: 'code',
      backend: 'claude',
      title: 'source',
      project_id: null,
      cwd: '/workspace'
    }
    const ctx = withDataPort({
      ...passthroughRuntimeConfig(),
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      settings: { getAll: () => ({ language }) },
      mcp: { resolver: () => () => undefined }
    })
    const result = await resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'claude', agentSpawnEnv: () => ({}) } as never,
      {
        sessionId: null,
        projectId: null,
        text: 'continue',
        agentKind: 'code',
        [sourceField]: 'source'
      } as never
    )
    expect(result).toMatchObject({ ok: true, value: { continuityLang: expected } })
  }
)
