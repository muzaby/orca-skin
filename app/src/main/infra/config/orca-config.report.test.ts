import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadOrcaConfig } from './orca-config'
import { DEFAULT_ORCA_CONFIG, readOrcaFile } from './orca-file'
import { errorReportHub } from '../error-report'
import { setRootLogger } from '../log/registry'

vi.mock('./orca-file', async (original) => ({
  ...(await original<typeof import('./orca-file')>()),
  ensureOrcaFile: vi.fn(),
  readOrcaFile: vi.fn()
}))

afterEach(() => {
  setRootLogger(null)
  vi.restoreAllMocks()
})

describe('config error reporting', () => {
  it('logs every warning and publishes one aggregate card', () => {
    const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => log }
    setRootLogger(log)
    const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {})
    vi.mocked(readOrcaFile).mockReturnValue({
      config: DEFAULT_ORCA_CONFIG,
      warnings: ['first', 'second', 'third']
    })
    expect(loadOrcaConfig()).toBe(DEFAULT_ORCA_CONFIG)
    expect(log.warn).toHaveBeenCalledTimes(3)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][0]).toMatchObject({
      title: 'configInvalid',
      detail: 'first 외 2건'
    })
  })
  it('keeps the default fallback when the file cannot be loaded, with a warning and toast', () => {
    const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => log }
    setRootLogger(log)
    const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {})
    vi.mocked(readOrcaFile).mockImplementation(() => {
      throw new Error('unreadable')
    })
    expect(loadOrcaConfig()).toBe(DEFAULT_ORCA_CONFIG)
    expect(log.warn).toHaveBeenCalledWith(
      'config.orca.load-failed',
      expect.objectContaining({ fallback: 'defaults' })
    )
    expect(publish.mock.calls[0][0]).toMatchObject({ title: 'configInvalid', detail: 'unreadable' })
  })
})
