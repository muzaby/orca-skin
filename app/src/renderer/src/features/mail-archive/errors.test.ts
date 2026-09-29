import { expect, it } from 'vitest'
import { mailArchiveErrorKey } from './errors'

it('maps direct and Electron-wrapped errors without exposing paths or raw messages', () => {
  expect(
    mailArchiveErrorKey(
      new Error(
        "Error invoking remote method 'orca:mailArchive:exportAttachment': Error: mail_attachment_source_changed"
      )
    )
  ).toBe('mailArchiveRepair.sourceChanged')
  expect(mailArchiveErrorKey('mail_pst_folder_read_failed')).toBe('mailArchiveRepair.damagedPst')
  expect(mailArchiveErrorKey(new Error('EACCES C:/private/archive.pst'))).toBe(
    'mailArchiveRepair.failed'
  )
})
