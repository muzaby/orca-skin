import { beforeEach, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { CHANNELS } from '../../../shared/ipc'
import { MailArchiveImportRequestSchema } from '../../../shared/mail-archive'
import type { MailArchiveService } from '../../features/plugins/mail-archive/service'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown, event: IpcMainInvokeEvent) => unknown>(),
  pick: vi.fn()
}))
vi.mock('electron', () => ({ BrowserWindow: {}, dialog: { showOpenDialog: mocks.pick } }))
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _mode: unknown,
    handler: (value: unknown, event: IpcMainInvokeEvent) => unknown
  ) => mocks.handlers.set(channel, handler),
  handlePlain: (channel: string, handler: (value: unknown, event: IpcMainInvokeEvent) => unknown) =>
    mocks.handlers.set(channel, handler)
}))
import { registerMailArchiveHandlers } from './mail-archive'

beforeEach(() => {
  mocks.handlers.clear()
  mocks.pick.mockReset()
})

it('keeps picker paths in main and consumes a window-bound selection only once', async () => {
  const importMail = vi.fn().mockResolvedValue({ state: 'completed' })
  registerMailArchiveHandlers({ import: importMail } as unknown as MailArchiveService)
  const event = { sender: {} } as IpcMainInvokeEvent
  const otherWindow = { sender: {} } as IpcMainInvokeEvent
  mocks.pick.mockResolvedValue({ canceled: false, filePaths: ['C:/private/customer.pst'] })
  const selection = await mocks.handlers.get(CHANNELS.mailArchivePickFiles)!(undefined, event)
  expect(MailArchiveImportRequestSchema.safeParse(selection).success).toBe(true)
  expect(JSON.stringify(selection)).not.toContain('private')
  const importer = mocks.handlers.get(CHANNELS.mailArchiveImport)!
  await expect(importer(selection, otherWindow)).rejects.toThrow('mail_source_not_selected')
  await importer(selection, event)
  expect(importMail).toHaveBeenCalledWith(
    { inputKind: 'files', paths: ['C:/private/customer.pst'] },
    expect.any(Function)
  )
  await expect(importer(selection, event)).rejects.toThrow('mail_source_not_selected')
  expect(
    MailArchiveImportRequestSchema.safeParse({
      inputKind: 'files',
      paths: ['C:/private/customer.eml']
    }).success
  ).toBe(false)
})

it('only exposes the PST picker and rejects EML paths returned by the OS dialog', async () => {
  const importMail = vi.fn()
  registerMailArchiveHandlers({ import: importMail } as unknown as MailArchiveService)
  expect(mocks.handlers.has('orca:mailArchive:pickEmlFolder')).toBe(false)
  const event = { sender: {} } as IpcMainInvokeEvent
  const picker = mocks.handlers.get(CHANNELS.mailArchivePickFiles)!
  mocks.pick.mockResolvedValueOnce({ canceled: false, filePaths: ['C:/private/good.pst'] })
  const selection = await picker(undefined, event)
  expect(mocks.pick).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: [{ name: 'PST 메일 원본', extensions: ['pst'] }]
    })
  )
  mocks.pick.mockResolvedValueOnce({
    canceled: false,
    filePaths: ['C:/private/good.pst', 'C:/private/customer.eml']
  })
  await expect(picker(undefined, event)).rejects.toThrow('mail_source_unsupported')
  await expect(mocks.handlers.get(CHANNELS.mailArchiveImport)!(selection, event)).rejects.toThrow(
    'mail_source_not_selected'
  )
  expect(importMail).not.toHaveBeenCalled()
})
