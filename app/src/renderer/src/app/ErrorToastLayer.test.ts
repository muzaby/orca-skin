import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorToastHost } from '../shared/ui/ErrorToastHost'
import { useSettingsModalStore } from '../features/settings/store/settingsModalStore'
import { errorApi } from '../shared/api/ipc'
import { openErrorTarget } from './errorToastTarget'
import { ErrorToastLayer } from './ErrorToastLayer'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../features/settings/store/settingsModalStore', async (original) => {
  const actual = await original<typeof import('../features/settings/store/settingsModalStore')>()
  return { ...actual, useOpenSettings: () => actual.useSettingsModalStore.getState().show }
})
vi.mock('./errorToastTarget', async (original) => {
  const actual = await original<typeof import('./errorToastTarget')>()
  return { ...actual, openErrorTarget: vi.fn(actual.openErrorTarget) }
})

afterEach(() => {
  useSettingsModalStore.setState({ open: false, tab: 'general' })
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorToastLayer production wiring', () => {
  it('mounts Host and supplies live navigation, settings and preload wrapper dependencies', async () => {
    const revealLog = vi.fn(async () => {})
    vi.stubGlobal('window', { orca: { error: { revealLog } } })
    const element = ErrorToastLayer()
    expect(element.type).toBe(ErrorToastHost)
    const onOpen = element.props.onOpen as Parameters<typeof ErrorToastHost>[0]['onOpen']
    const target = { kind: 'page', path: '/plugins' } as const
    onOpen(target)
    expect(openErrorTarget).toHaveBeenCalledExactlyOnceWith(target, {
      navigate,
      openSettings: useSettingsModalStore.getState().show,
      revealLog: errorApi.revealLog
    })
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/plugins')
    onOpen({ kind: 'settings', tab: 'usage' })
    expect(useSettingsModalStore.getState()).toMatchObject({ open: true, tab: 'usage' })
    onOpen(undefined)
    await Promise.resolve()
    expect(revealLog).toHaveBeenCalledExactlyOnceWith()
  })
})
