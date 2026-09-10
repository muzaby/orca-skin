import { expect, it } from 'vitest'
import { artifactOperationIssues } from './artifactOperationIssues'

it('omits successful saves, reveal, trash and cancelled save dialogs', () => {
  expect(artifactOperationIssues({ ok: true })).toEqual([])
  expect(artifactOperationIssues({ outcome: 'trashed', deletionRecorded: true })).toEqual([])
  expect(artifactOperationIssues({ outcome: 'cancelled', items: [] })).toEqual([])
  expect(
    artifactOperationIssues({
      outcome: 'completed',
      items: [{ publicationId: 'p', outcome: 'saved' }]
    })
  ).toEqual([])
})

it('preserves partial failures and an unrecorded trash without announcing successful items', () => {
  expect(
    artifactOperationIssues({
      outcome: 'completed',
      items: [
        { publicationId: 'saved', outcome: 'saved' },
        { publicationId: 'failed', outcome: 'failed', reason: 'access-denied' }
      ]
    })
  ).toEqual([{ publicationId: 'failed', reason: 'access-denied' }])
  expect(artifactOperationIssues({ outcome: 'trashed', deletionRecorded: false })).toEqual([
    { unrecorded: true }
  ])
  expect(artifactOperationIssues({ outcome: 'failed', items: [], reason: 'busy' })).toEqual([
    { reason: 'busy' }
  ])
})
