import { beforeEach, describe, expect, it, vi } from 'vitest'
import { join, dirname } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import { installFakeShellServices } from '../../infra/shell-services.testfixture'
import { registerErrorHandlers } from './error'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  flush: vi.fn(),
  path: vi.fn(),
  exists: vi.fn(),
  reveal: vi.fn(),
  open: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle }
}))
vi.mock('node:fs', () => ({ existsSync: mocks.exists }))
vi.mock('../../infra/log', () => ({ currentLogFilePath: mocks.path, flushLogSync: mocks.flush }))
const path = join('test-config', 'logs', 'application.jsonl')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.path.mockReturnValue(path)
  mocks.exists.mockReturnValue(true)
  mocks.open.mockResolvedValue('')
  // 로그 열기는 셸 서비스로 간다(0324 EP-10).
  installFakeShellServices({
    'external.showItemInFolder': mocks.reveal,
    'external.openPath': mocks.open
  })
  registerErrorHandlers()
})
function reveal(): Promise<void> {
  const handler = mocks.handle.mock.calls.find(
    ([channel]) => channel === CHANNELS.errorRevealLog
  )![1]
  return handler({})
}
describe('error revealLog IPC handler', () => {
  it('flushes before checking and selecting the current log file', async () => {
    await reveal()
    expect(mocks.flush).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.exists).toHaveBeenCalledExactlyOnceWith(path)
    expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith(path)
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.exists.mock.invocationCallOrder[0]
    )
    expect(mocks.exists.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reveal.mock.invocationCallOrder[0]
    )
  })
  it('opens the log directory if the file is not present', async () => {
    mocks.exists.mockReturnValue(false)
    await reveal()
    expect(mocks.flush).toHaveBeenCalledTimes(1)
    expect(mocks.reveal).not.toHaveBeenCalled()
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith(dirname(path))
  })
  it('rejects an OS folder error instead of reporting success', async () => {
    mocks.exists.mockReturnValue(false)
    mocks.open.mockResolvedValue('access denied')
    await expect(reveal()).rejects.toThrow('access denied')
  })
})
