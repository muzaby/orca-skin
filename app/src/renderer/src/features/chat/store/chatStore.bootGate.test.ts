import { afterEach, expect, it, vi } from 'vitest'
const reportError = vi.hoisted(() => vi.fn())
vi.mock('../../../shared/errors', () => ({ reportError }))
import { installChatStoreHarness } from './chatStore.testHarness'
import { bootstrapChat, getActiveChatSession } from './chatStore'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function fixture(): {
  ready: () => void
  fail: (reason: Error) => void
  cwd: ReturnType<typeof vi.fn>
  cleanup: () => void
} {
  installChatStoreHarness({ sessionId: null, cwd: null })
  let ready!: () => void
  let fail!: (reason: Error) => void
  const pending = new Promise<void>((resolve, reject) => {
    ready = resolve
    fail = reject
  })
  const cwd = vi.fn().mockResolvedValue('C:/boot')
  const off = (): void => {}
  Object.assign(window.oo, {
    boot: { whenReady: () => pending },
    session: { cwd, onTitle: () => off },
    settings: { get: async () => ({}) },
    concurrency: { onEvent: () => off }
  })
  window.oo.chat.onEvent = () => off
  return { ready, fail, cwd, cleanup: bootstrapChat() }
}

it('0304 waits for main-ready, then seeds cwd exactly once', async () => {
  const f = fixture()
  expect(f.cwd).not.toHaveBeenCalled()
  await Promise.resolve()
  await Promise.resolve()
  expect(f.cwd).not.toHaveBeenCalled()
  f.ready()
  await vi.waitFor(() => expect(getActiveChatSession().cwd).toBe('C:/boot'))
  expect(f.cwd).toHaveBeenCalledTimes(1)
  f.cleanup()
})
it('0304 leaves readiness failure to BootScreen', async () => {
  const f = fixture()
  f.fail(new Error('boot failed'))
  await Promise.resolve()
  await Promise.resolve()
  expect(f.cwd).not.toHaveBeenCalled()
  expect(reportError).not.toHaveBeenCalled()
  f.cleanup()
})
it('0304 reports a cwd failure after readiness once', async () => {
  const f = fixture()
  const error = new Error('cwd denied')
  f.cwd.mockRejectedValue(error)
  f.ready()
  await vi.waitFor(() =>
    expect(reportError).toHaveBeenCalledExactlyOnceWith({
      event: 'chat.cwd.load-failed',
      scope: 'chat',
      title: 'loadFailed',
      error
    })
  )
  f.cleanup()
})
