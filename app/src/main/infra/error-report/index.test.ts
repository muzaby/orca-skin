import { afterEach, describe, expect, it, vi } from 'vitest'
import { setRootLogger } from '../log/registry'
import { errorReportHub, reportError } from './index'

afterEach(() => {
  setRootLogger(null)
  vi.restoreAllMocks()
})

function logger(): { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } {
  const error = vi.fn(),
    warn = vi.fn()
  const log = { error, warn, info: vi.fn(), debug: vi.fn(), child: () => log }
  setRootLogger(log)
  return log
}

describe('main reportError (no Electron dependency)', () => {
  it.each(['error', 'warn'] as const)(
    'logs %s exactly once before publishing a bounded detail',
    (level) => {
      const log = logger()
      const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {
        expect(log[level]).toHaveBeenCalledTimes(1)
      })
      const error = new Error('x'.repeat(400))
      reportError({
        event: 'app.uncaught.exception',
        scope: 'app',
        title: 'unexpected',
        error,
        level,
        data: { marker: 1 }
      })
      expect(log[level].mock.calls[0][0]).toBe('app.uncaught.exception')
      expect(publish).toHaveBeenCalledTimes(1)
      expect(publish.mock.calls[0][0]).toMatchObject({
        title: 'unexpected',
        detail: 'x'.repeat(299) + '…',
        origin: 'main'
      })
    }
  )

  it('distinguishes absent, explicit and redacted details', () => {
    logger()
    const publish = vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {})
    const input = { event: 'app.uncaught.exception', scope: 'app', title: 'unexpected' as const }
    reportError(input)
    reportError({ ...input, error: new Error('hidden'), detail: null })
    reportError({ ...input, error: new Error('unused'), detail: 'explicit' })
    expect(publish.mock.calls.map(([r]) => r.detail)).toEqual([undefined, undefined, 'explicit'])
  })

  it('does not throw or recursively log when delivery or the logger fails', () => {
    const log = logger()
    vi.spyOn(errorReportHub, 'publish').mockImplementation(() => {
      throw new Error('sink')
    })
    const input = {
      event: 'app.unhandled.rejection',
      scope: 'app',
      title: 'unexpected' as const,
      error: 'failure'
    }
    expect(() => reportError(input)).not.toThrow()
    expect(log.error).toHaveBeenCalledTimes(1)
    log.error.mockImplementation(() => {
      throw new Error('logger')
    })
    expect(() => reportError(input)).not.toThrow()
    expect(log.error).toHaveBeenCalledTimes(2)
  })
})
