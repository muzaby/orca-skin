import { afterEach, expect, it, vi } from 'vitest'
import { resolveTurn } from './resolve-turn'
import { recoverSessionHistory } from '../../features/chat/recovery'

vi.mock('../../features/chat/recovery', () => ({ recoverSessionHistory: vi.fn() }))
vi.mock('../../infra/config/orca-config', () => ({ appEnv: () => ({}) }))
afterEach(() => vi.clearAllMocks())

it.each(['sessionId', 'forkFrom', 'handoffFrom'] as const)(
  'rejects source deletion during asynchronous provider preparation (%s)',
  async (sourceField) => {
    let source: Record<string, unknown> | undefined = {
      agent_kind: 'work',
      backend: 'claude',
      title: 'source',
      project_id: null,
      cwd: '/workspace'
    }
    const ctx = {
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      settings: { getAll: () => ({ language: 'ko' }) },
      mcp: { resolver: () => () => undefined }
    }
    const pending = resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'claude' } as never,
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
  }
)

it.each(['coding', 'corrupt'])(
  'rejects source kind changes during preparation (%s)',
  async (agentKind) => {
    let source = { agent_kind: 'work', backend: 'claude', project_id: null, cwd: '/workspace' }
    const ctx = {
      db: { getSessionById: () => source },
      harnessSettings: { list: () => [] },
      mcp: { resolver: () => () => undefined }
    }
    const pending = resolveTurn(
      ctx as never,
      { hasSession: () => false } as never,
      { id: 'claude' } as never,
      { sessionId: 'source', projectId: null, text: 'continue', agentKind: 'work' } as never
    )
    source = { ...source, agent_kind: agentKind }
    expect(await pending).toMatchObject({
      ok: false,
      error: { category: 'schema_validation_error' }
    })
    expect(recoverSessionHistory).not.toHaveBeenCalled()
  }
)
