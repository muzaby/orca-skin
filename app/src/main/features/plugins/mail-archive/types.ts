import type { MailArchiveAttachment, MailArchiveSourceKind } from '../../../../shared/mail-archive'

export interface NormalizedArchiveMail {
  readonly sourceKind: MailArchiveSourceKind
  readonly sourcePath: string
  readonly sourceFingerprint: string
  readonly itemKey: string
  readonly folderPath: string | null
  readonly sentAt: number | null
  readonly from: string
  readonly to: string
  readonly cc: string
  readonly subject: string
  readonly bodyText: string
  readonly messageId: string | null
  readonly inReplyTo: string | null
  readonly references: string | null
  readonly threadKey: string
  readonly attachments: readonly Omit<MailArchiveAttachment, 'id'>[]
  readonly sizeBytes: number
}

export interface ArchiveImportSource {
  readonly path: string
  readonly kind: MailArchiveSourceKind
}
