import { afterEach, describe, expect, it } from 'vitest'
import { archiveSearchRequest, EMPTY_ARCHIVE_SEARCH } from './search-request'
import { MailArchiveSearchRequestSchema } from '../../../../shared/mail-archive'

const originalTimezone = process.env.TZ
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
})
describe('archive explicit search request', () => {
  it('preserves every field and uses local inclusive dates with an exclusive next midnight', () => {
    const result = archiveSearchRequest({
      ...EMPTY_ARCHIVE_SEARCH,
      source: 'opaque-source',
      query: 'QA 승인',
      from: ' 민수 ',
      to: 'team@',
      cc: 'review@',
      attachmentName: '%_',
      folderPath: '받은',
      startDate: '2026-09-29',
      endDate: '2026-09-29'
    })
    expect(result).toEqual({
      request: {
        query: 'QA 승인',
        sourceId: 'opaque-source',
        from: '민수',
        to: 'team@',
        cc: 'review@',
        attachmentName: '%_',
        folderPath: '받은',
        sentAfter: new Date(2026, 8, 29).getTime(),
        sentBefore: new Date(2026, 8, 30).getTime(),
        limit: 50
      }
    })
  })
  it('uses a calendar day across a DST transition', () => {
    process.env.TZ = 'America/New_York'
    const result = archiveSearchRequest({
      ...EMPTY_ARCHIVE_SEARCH,
      startDate: '2026-03-08',
      endDate: '2026-03-08'
    })
    expect(result.error).toBeUndefined()
    expect(result.request!.sentBefore! - result.request!.sentAfter!).toBe(23 * 60 * 60 * 1000)
  })
  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-09-31', 'invalid'])(
    'rejects invalid calendar input %s',
    (startDate) => {
      expect(archiveSearchRequest({ ...EMPTY_ARCHIVE_SEARCH, startDate })).toEqual({
        error: 'invalidDate'
      })
    }
  )
  it('rejects reversed dates and excessive filters without constructing a request', () => {
    expect(
      archiveSearchRequest({
        ...EMPTY_ARCHIVE_SEARCH,
        startDate: '2026-09-30',
        endDate: '2026-09-29'
      })
    ).toEqual({ error: 'reversedDates' })
    expect(archiveSearchRequest({ ...EMPTY_ARCHIVE_SEARCH, from: 'a'.repeat(501) })).toEqual({
      error: 'invalidFilters'
    })
    expect(
      MailArchiveSearchRequestSchema.safeParse({ query: '', sentAfter: 10, sentBefore: 10 }).success
    ).toBe(false)
    expect(MailArchiveSearchRequestSchema.safeParse({ query: '', sentAfter: NaN }).success).toBe(
      false
    )
    expect(
      MailArchiveSearchRequestSchema.safeParse({ query: '', sourcePath: 'C:/private' }).success
    ).toBe(false)
  })
})
