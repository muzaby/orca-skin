import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadOoConfig } from './oo-config'
import { DEFAULT_OO_CONFIG, readOoFile } from './oo-file'
import { errorReportHub } from '../error-report'
import { setRootLogger } from '../log/registry'

vi.mock('./oo-file', async (original) => ({
  ...(await original<typeof import('./oo-file')>()),
  ensureOoFile: vi.fn(),
  readOoFile: vi.fn()
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
    vi.mocked(readOoFile).mockReturnValue({
      config: DEFAULT_OO_CONFIG,
      warnings: ['first', 'second', 'third']
    })
    expect(loadOoConfig()).toBe(DEFAULT_OO_CONFIG)
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
    vi.mocked(readOoFile).mockImplementation(() => {
      throw new Error('unreadable')
    })
    expect(loadOoConfig()).toBe(DEFAULT_OO_CONFIG)
    expect(log.warn).toHaveBeenCalledWith(
      'config.orcinus-orca.load-failed',
      expect.objectContaining({ fallback: 'defaults' })
    )
    expect(publish.mock.calls[0][0]).toMatchObject({ title: 'configInvalid', detail: 'unreadable' })
  })
})
