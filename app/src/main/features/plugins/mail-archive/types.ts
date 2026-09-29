import type { MailArchiveAttachment, MailArchiveSourceKind } from '../../../../shared/mail-archive'

export interface NormalizedArchiveMail {
  readonly sourceKind: MailArchiveSourceKind
  readonly sourceId: string
  readonly sourcePath: string
  readonly sourceFingerprint: string
  readonly itemKey: string
  readonly identityKey: string
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

export interface MailArchiveAttachmentLocation {
  readonly attachmentId: string
  readonly sourceId: string
  readonly sourceKind: MailArchiveSourceKind
  readonly sourcePath: string
  readonly sourceFingerprint: string
  readonly itemKey: string
  readonly attachmentIndex: number
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface MailArchiveAttachmentExportInput extends MailArchiveAttachmentLocation {
  readonly destinationPath: string
}

export interface MailArchiveAttachmentExportOutput {
  readonly temporaryPath: string
  readonly bytesWritten: number
}
