import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadElectronAutoUpdater } from './updater'
import { errorReportHub } from '../infra/error-report'
import { setRootLogger } from '../infra/log/registry'

vi.mock('electron', () => ({ app: {}, BrowserWindow: {} }))
vi.mock('node:module', () => ({
  createRequire: () => () => {
    throw new Error('module unavailable')
  }
}))
afterEach(() => {
  setRootLogger(null)
  vi.restoreAllMocks()
})

describe('updater loader reporting', () => {
  it('keeps dev log-only and reports unavailable packaged updates', () => {
    const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: () => log }
    setRootLogger(log)
    const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {})
    expect(loadElectronAutoUpdater()).toBeNull()
    expect(publish).not.toHaveBeenCalled()
    expect(loadElectronAutoUpdater({ reportUnavailable: true })).toBeNull()
    expect(log.warn).toHaveBeenCalledTimes(2)
    expect(publish.mock.calls[0][0]).toMatchObject({
      title: 'updaterUnavailable',
      detail: 'module unavailable'
    })
  })
})
