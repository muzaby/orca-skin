import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedPermissionMode } from '../../../shared/permission-mode'
import type { AgentKind } from '../../../shared/agent-kind'
const hooks = vi.hoisted(
  () =>
    new Map<
      string,
      (payload: {
        sessionId: string
        mode: NormalizedPermissionMode
      }) => Promise<NormalizedPermissionMode | undefined>
    >()
)
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _options: unknown,
    handler: (payload: {
      sessionId: string
      mode: NormalizedPermissionMode
    }) => Promise<NormalizedPermissionMode | undefined>
  ) => hooks.set(channel, handler)
}))
import { ApprovalCoordinator } from './coordinator'
import { CHANNELS } from '../../../shared/ipc'

function setup(
  kind: AgentKind | undefined,
  model?: string,
  live = true,
  permissionModel?: string
): {
  current: {
    turn:
      | {
          agentKind: AgentKind
          live: {
            spawnedModel: string | undefined
            spawnedPermissionModel?: string
            setPermissionMode: ReturnType<typeof vi.fn>
          }
        }
      | undefined
  }
  setPermissionMode: ReturnType<typeof vi.fn>
  setMode: ReturnType<typeof vi.fn>
  invoke: (mode: NormalizedPermissionMode) => Promise<NormalizedPermissionMode | undefined>
} {
  const setPermissionMode = vi.fn().mockResolvedValue(undefined)
  const setMode = vi.fn()
  const turn =
    kind && live
      ? {
          agentKind: kind,
          live: { spawnedModel: model, spawnedPermissionModel: permissionModel, setPermissionMode }
        }
      : undefined
  const current = { turn }
  new ApprovalCoordinator().registerHandlers(
    { getBySession: () => current.turn } as never,
    { setMode } as never,
    () => kind
  )
  return {
    current,
    setPermissionMode,
    setMode,
    invoke: (mode: NormalizedPermissionMode) =>
      hooks.get(CHANNELS.permissionSetMode)!({ sessionId: 's', mode })
  }
}
beforeEach(() => hooks.clear())
describe('r4 live permission actual model and applied response', () => {
  it.each([
    ['work', 'claude-sonnet-4-5', 'auto_classified', undefined],
    ['code', 'claude-sonnet-4-5', 'auto_classified', undefined],
    ['work', 'claude-sonnet-4-6', 'auto_classified', 'auto_classified'],
    ['work', undefined, 'auto_classified', undefined],
    ['code', 'corp-sonnet-9', 'auto_classified', undefined]
  ] as const)('%s %s settles %s', async (kind, model, expected, sdk) => {
    const h = setup(kind, model)
    expect(await h.invoke('auto_classified')).toBe(expected)
    if (sdk === undefined) expect(h.setPermissionMode).not.toHaveBeenCalled()
    else expect(h.setPermissionMode).toHaveBeenCalledExactlyOnceWith(sdk)
    expect(h.setMode).toHaveBeenCalledWith('s', expected)
  })
  it('idle keeps selected auto until next resolved send; Work hidden values become manual', async () => {
    const h = setup('work', undefined, false)
    expect(await h.invoke('auto_classified')).toBe('auto_classified')
    expect(await h.invoke('accept_edits')).toBe('default')
    expect(h.setPermissionMode).not.toHaveBeenCalled()
  })
  it('SDK failure does not report or store success', async () => {
    const h = setup('work', 'claude-sonnet-4-6')
    h.setPermissionMode.mockRejectedValue(new Error('closed'))
    expect(await h.invoke('bypass')).toBeUndefined()
    expect(h.setMode).not.toHaveBeenCalled()
  })
  it('missing session never applies permission', async () => {
    const h = setup(undefined)
    expect(await h.invoke('bypass')).toBeUndefined()
    expect(h.setMode).not.toHaveBeenCalled()
  })
})

describe('r4 Main live request lifetime', () => {
  it('serializes setters and preserves latest request order', async () => {
    const h = setup('work', 'claude-sonnet-4-6')
    let finish!: () => void
    h.setPermissionMode.mockReturnValueOnce(
      new Promise<void>((r) => {
        finish = r
      })
    )
    const first = h.invoke('bypass'),
      second = h.invoke('default')
    await Promise.resolve()
    await Promise.resolve()
    expect(h.setPermissionMode).toHaveBeenCalledTimes(1)
    finish()
    await first
    await second
    expect(h.setPermissionMode.mock.calls.map((call) => call[0])).toEqual(['bypass', 'default'])
    expect(h.setMode).toHaveBeenLastCalledWith('s', 'default')
  })
  it('retired turn response does not overwrite a new turn or an idle controller', async () => {
    const h = setup('work', 'claude-sonnet-4-6')
    let finish!: () => void
    h.setPermissionMode.mockReturnValueOnce(
      new Promise<void>((r) => {
        finish = r
      })
    )
    const request = h.invoke('bypass')
    await Promise.resolve()
    await Promise.resolve()
    h.current.turn = undefined
    finish()
    expect(await request).toBeUndefined()
    expect(h.setMode).not.toHaveBeenCalled()
  })
})

it('0304 applies auto to a resolved alias and bypass to an older live model', async () => {
  const alias = setup('work', 'haiku', true, 'claude-haiku-5-5')
  expect(await alias.invoke('auto_classified')).toBe('auto_classified')
  expect(alias.setPermissionMode).toHaveBeenCalledExactlyOnceWith('auto_classified')
  const older = setup('code', 'claude-sonnet-4-5')
  expect(await older.invoke('bypass')).toBe('bypass')
  expect(older.setPermissionMode).toHaveBeenCalledExactlyOnceWith('bypass')
})

// 0324 — 세션 종류는 데이터 호스트에 묻는다(비동기). 진행 중인 턴이 없는 세션의 선택이 저장돼야 한다.
describe('0324 asynchronous session kind', () => {
  interface AsyncSetup {
    lookup: ReturnType<typeof vi.fn>
    setMode: ReturnType<typeof vi.fn>
    setPermissionMode: ReturnType<typeof vi.fn>
    current: { turn?: { agentKind: AgentKind; live: unknown } }
    invoke: (mode: NormalizedPermissionMode) => Promise<NormalizedPermissionMode | undefined>
    answer: () => void
  }
  function asyncSetup(kind: AgentKind | undefined): AsyncSetup {
    let answer!: (value: AgentKind | undefined) => void
    const lookup = vi.fn(
      () =>
        new Promise<AgentKind | undefined>((resolve) => {
          answer = resolve
        })
    )
    const setMode = vi.fn()
    const setPermissionMode = vi.fn().mockResolvedValue(undefined)
    const current: { turn?: { agentKind: AgentKind; live: unknown } } = {}
    new ApprovalCoordinator().registerHandlers(
      { getBySession: () => current.turn } as never,
      { setMode } as never,
      lookup
    )
    const invoke = (
      mode: NormalizedPermissionMode
    ): Promise<NormalizedPermissionMode | undefined> =>
      hooks.get(CHANNELS.permissionSetMode)!({ sessionId: 's', mode })
    return { lookup, setMode, setPermissionMode, current, invoke, answer: () => answer(kind) }
  }

  it('idle session stores the selection after the kind arrives', async () => {
    const h = asyncSetup('code')
    const request = h.invoke('bypass')
    await vi.waitFor(() => expect(h.lookup).toHaveBeenCalledExactlyOnceWith('s'))
    expect(h.setMode).not.toHaveBeenCalled()
    h.answer()
    expect(await request).toBe('bypass')
    expect(h.setMode).toHaveBeenCalledExactlyOnceWith('s', 'bypass')
  })

  it('a turn that started during the lookup decides with its own live state', async () => {
    const h = asyncSetup('code')
    const request = h.invoke('bypass')
    await vi.waitFor(() => expect(h.lookup).toHaveBeenCalledOnce())
    h.current.turn = {
      agentKind: 'code',
      live: { spawnedModel: 'claude-sonnet-4-5', setPermissionMode: h.setPermissionMode }
    }
    h.answer()
    await vi.waitFor(() => expect(h.setPermissionMode).toHaveBeenCalledExactlyOnceWith('bypass'))
    // 적용 뒤 확인 읽기.
    await vi.waitFor(() => expect(h.lookup).toHaveBeenCalledTimes(2))
    h.answer()
    expect(await request).toBe('bypass')
    expect(h.setMode).toHaveBeenCalledExactlyOnceWith('s', 'bypass')
  })

  it('a turn that started during the lookup without a live runtime never applies', async () => {
    const h = asyncSetup('code')
    const request = h.invoke('bypass')
    await vi.waitFor(() => expect(h.lookup).toHaveBeenCalledOnce())
    h.current.turn = { agentKind: 'code', live: undefined }
    h.answer()
    expect(await request).toBeUndefined()
    expect(h.setMode).not.toHaveBeenCalled()
  })

  it('a live turn does not ask for the kind before applying', async () => {
    const h = asyncSetup('code')
    h.current.turn = {
      agentKind: 'code',
      live: { spawnedModel: 'claude-sonnet-4-5', setPermissionMode: h.setPermissionMode }
    }
    const request = h.invoke('bypass')
    await vi.waitFor(() => expect(h.setPermissionMode).toHaveBeenCalledOnce())
    // 적용 뒤 세션 종류를 다시 확인한다 — 그 답 전에는 저장하지 않는다.
    expect(h.lookup).toHaveBeenCalledOnce()
    expect(h.setMode).not.toHaveBeenCalled()
    h.answer()
    expect(await request).toBe('bypass')
  })
})
