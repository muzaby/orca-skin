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
