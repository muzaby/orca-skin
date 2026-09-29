import { describe, expect, it } from 'vitest'
import { walkPstMail, type PstFolderLike } from './pst-walk'

function folder(items: unknown[], children: PstFolderLike[] = []): PstFolderLike {
  return {
    hasSubfolders: children.length > 0,
    getSubFolders: () => children,
    getNextChild: () => items.shift() ?? null
  }
}

describe('PST traversal', () => {
  it('reads until null even when the fallback count is -1 and excludes non-mail subclasses', async () => {
    const root = {
      ...folder([
        { messageClass: 'IPM.Appointment' },
        { messageClass: 'IPM.Contact' },
        { messageClass: 'IPM.Task' },
        { messageClass: 'IPM.Note', subject: 'first' },
        { messageClass: 'IPM.Note.SMIME', subject: 'second' }
      ]),
      emailCount: -1
    }
    const subjects: string[] = []
    await walkPstMail(root, (mail) => {
      subjects.push(mail.subject)
    })
    expect(subjects).toEqual(['first', 'second'])
  })

  it('fails a corrupt item table instead of silently accepting a partial revision', async () => {
    const root = folder([])
    root.getNextChild = () => {
      throw new Error('private source path')
    }
    await expect(walkPstMail(root, () => undefined)).rejects.toThrow('mail_pst_folder_read_failed')
  })

  it('detects a child silently skipped inside the parser library', async () => {
    const root = { ...folder([{ messageClass: 'IPM.Note' }]), emailCount: 2 }
    await expect(walkPstMail(root, () => undefined)).rejects.toThrow('mail_pst_folder_read_failed')
  })

  it('fails a corrupt subtree and observes cancellation before reading', async () => {
    const root = folder([], [folder([])])
    root.getSubFolders = () => {
      throw new Error('broken child table')
    }
    await expect(walkPstMail(root, () => undefined)).rejects.toThrow(
      'mail_pst_subfolders_read_failed'
    )
    const controller = new AbortController()
    controller.abort()
    await expect(walkPstMail(root, () => undefined, controller.signal)).rejects.toThrow()
  })
})
