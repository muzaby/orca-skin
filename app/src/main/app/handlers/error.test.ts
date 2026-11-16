import { beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import { installFakeShellServices } from '../../infra/shell-services.testfixture'
import { registerErrorHandlers } from './error'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  flush: vi.fn(),
  directory: vi.fn(),
  reveal: vi.fn(),
  open: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle }
}))
vi.mock('../../infra/log', () => ({ logDirectory: mocks.directory, flushLogSync: mocks.flush }))
const directory = join('test-config', 'logs')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.directory.mockReturnValue(directory)
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
  // 0324 AC46 — 프로세스마다 파일이 달라 한 파일을 고르지 않고 폴더를 연다.
  it('flushes, then opens the log directory', async () => {
    await reveal()
    expect(mocks.flush).toHaveBeenCalledExactlyOnceWith()
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith(directory)
    expect(mocks.reveal).not.toHaveBeenCalled()
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.open.mock.invocationCallOrder[0]
    )
  })
  it('rejects an OS folder error instead of reporting success', async () => {
    mocks.open.mockResolvedValue('access denied')
    await expect(reveal()).rejects.toThrow('access denied')
  })
})
