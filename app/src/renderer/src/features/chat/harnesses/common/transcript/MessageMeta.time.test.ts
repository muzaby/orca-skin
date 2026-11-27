import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { formatTimeFull, formatTimeShort } from '../../../../../shared/i18n/datetime'
import { renderWithTranscript } from '../../registries/transcript.testfixture'
import { MessageMeta } from './MessageMeta'

vi.mock('../../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../../shared/i18n')>()),
  useI18n: () => ({ locale: 'en', tr: (key: string) => key })
}))

afterEach(() => {
  vi.restoreAllMocks()
})

it('reads the OS time zone once for both labels and observes a changed zone on the next render', () => {
  const createdAt = Date.UTC(2026, 6, 15, 3, 30)
  vi.spyOn(Date, 'now').mockReturnValue(createdAt + 60_000)
  const nativeOptions = Intl.DateTimeFormat.prototype.resolvedOptions
  let osZone = 'America/New_York'
  const reads = vi
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...nativeOptions.call(this), timeZone: osZone }
    })

  for (const zone of ['America/New_York', 'Asia/Seoul']) {
    reads.mockClear()
    osZone = zone
    const html = renderWithTranscript(
      createElement(MessageMeta, { text: '', createdAt, align: 'left' })
    )
    expect(reads).toHaveBeenCalledTimes(1)
    const options = { timeZone: zone }
    expect(html).toContain(`title="${formatTimeFull(createdAt, 'en', options)}"`)
    expect(html).toContain(`>${formatTimeShort(createdAt, 'en', options)}</span>`)
  }
})
