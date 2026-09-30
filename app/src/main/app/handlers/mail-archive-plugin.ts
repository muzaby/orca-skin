import type { IpcMainInvokeEvent } from 'electron'
import { CHANNELS } from '../../../shared/ipc'
import {
  ArchiveSessionSchema,
  ArchiveScopeSchema,
  ArchiveEvidenceSchema
} from '../../../shared/mail-archive-plugin'
import type { MailArchivePlugin } from '../../features/plugins/mail-archive/plugin'
import { handle } from '../../infra/ipc/handle'

export function registerMailArchivePluginHandlers(
  plugin: MailArchivePlugin,
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean
): void {
  const check = (event: IpcMainInvokeEvent): void => {
    if (!isTrustedSender(event)) throw new Error('mail_archive_forbidden')
  }
  handle(
    CHANNELS.mailArchivePluginState,
    ArchiveSessionSchema.partial().strict(),
    'reject',
    (input, event) => {
      check(event)
      return plugin.state(input.sessionId)
    }
  )
  handle(CHANNELS.mailArchiveSetScope, ArchiveScopeSchema, 'reject', (input, event) => {
    check(event)
    return plugin.setScope(input)
  })
  handle(CHANNELS.mailArchiveResolveEvidence, ArchiveEvidenceSchema, 'reject', (input, event) => {
    check(event)
    return plugin.resolve(input.sessionId, input.id)
  })
}
