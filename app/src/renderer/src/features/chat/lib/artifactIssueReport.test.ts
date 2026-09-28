import { beforeEach, expect, it, vi } from 'vitest'
import { artifactIssueTitle, reportArtifactIssue } from './artifactIssueReport'
import { errorToastStore } from '../../../shared/errors/errorToastStore'

const logError = vi.fn()
beforeEach(() => {
  logError.mockReset()
  for (const toast of errorToastStore.getState().toasts)
    errorToastStore.getState().dismiss(toast.id)
  vi.stubGlobal('window', { orca: { log: { error: logError } } })
})

it('titles file-access reasons as fileUnavailable and everything else as actionFailed', () => {
  for (const reason of [
    'missing',
    'not-found',
    'access-denied',
    'forbidden',
    'unsafe-path',
    'io-error'
  ])
    expect(artifactIssueTitle(reason)).toBe('fileUnavailable')
  for (const reason of [undefined, 'too-large', 'too-many-items', 'trash-failed', 'SECRET_PATH'])
    expect(artifactIssueTitle(reason)).toBe('actionFailed')
})

it('reports one logged toast with the filename and the localized reason, never a raw reason', () => {
  reportArtifactIssue({ event: 'artifacts.save.failed', filename: 'a.md', reason: 'missing' })
  reportArtifactIssue({ event: 'artifacts.trash.failed', filename: 'b.md', reason: 'SECRET_PATH' })
  reportArtifactIssue({
    event: 'artifacts.trash.failed',
    filename: 'c.md',
    messageKey: 'chat.artifacts.trashedUnrecorded'
  })
  expect(errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))).toEqual(
    [
      {
        title: 'actionFailed',
        detail: 'c.md: 휴지통으로 이동했습니다. 이동 이력을 저장하지 못했습니다.'
      },
      {
        title: 'actionFailed',
        detail: 'b.md: 파일 작업을 완료하지 못했습니다. 다시 확인해 주세요.'
      },
      { title: 'fileUnavailable', detail: 'a.md: 파일 없음 — 삭제되었거나 이동되었습니다' }
    ]
  )
  expect(logError.mock.calls.map(([event, scope, , data]) => [event, scope, data])).toEqual([
    ['artifacts.save.failed', 'artifacts', { reason: 'missing' }],
    ['artifacts.trash.failed', 'artifacts', { reason: 'SECRET_PATH' }],
    ['artifacts.trash.failed', 'artifacts', undefined]
  ])
})
