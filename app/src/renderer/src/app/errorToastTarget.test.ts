import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AppErrorTarget } from '../../../shared/app-error'
import { errorToastStore } from '../shared/errors/errorToastStore'
import { openErrorTarget } from './errorToastTarget'

afterEach(() => {
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
  vi.unstubAllGlobals()
})

function dependencies(): {
  navigate: Mock
  openSettings: Mock
  revealLog: Mock<() => Promise<void>>
} {
  return { navigate: vi.fn(), openSettings: vi.fn(), revealLog: vi.fn(async () => {}) }
}

describe('toast navigation', () => {
  it('opens app pages and all settings tab forms without revealing logs', async () => {
    const deps = dependencies()
    await openErrorTarget({ kind: 'page', path: '/plugins' }, deps)
    expect(deps.navigate).toHaveBeenCalledExactlyOnceWith('/plugins')
    expect(deps.openSettings).not.toHaveBeenCalled()
    for (const tab of ['general', 'usage', 'mail-archive', 'provider:claude'] as const) {
      await openErrorTarget({ kind: 'settings', tab }, deps)
    }
    expect(deps.openSettings.mock.calls).toEqual([
      ['general'],
      ['usage'],
      ['mail-archive'],
      ['provider:claude']
    ])
    expect(deps.navigate).toHaveBeenCalledTimes(1)
    expect(deps.revealLog).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    null,
    'invalid',
    {},
    { kind: 'other' },
    { kind: 'page', path: 'plugins' },
    { kind: 'page', path: '//x' },
    { kind: 'page', path: 7 },
    { kind: 'settings', tab: 'plugins' },
    { kind: 'settings', tab: null }
  ])('reveals logs for absent or invalid targets: %j', async (target) => {
    const deps = dependencies()
    await openErrorTarget(target as AppErrorTarget | undefined, deps)
    expect(deps.revealLog).toHaveBeenCalledExactlyOnceWith()
    expect(deps.navigate).not.toHaveBeenCalled()
    expect(deps.openSettings).not.toHaveBeenCalled()
  })

  it('reports a rejected reveal once to the actual toast store and logger', async () => {
    const log = vi.fn()
    vi.stubGlobal('window', { orca: { log: { error: log } } })
    const deps = dependencies()
    deps.revealLog.mockRejectedValue(new Error('folder denied'))
    await openErrorTarget(undefined, deps)
    expect(errorToastStore.getState().toasts).toHaveLength(1)
    expect(errorToastStore.getState().toasts[0]).toMatchObject({
      title: 'openFailed',
      detail: 'folder denied'
    })
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toBe('errors.reveal-log.failed')
  })
})
