import type {
  MailArchiveAttachment,
  MailArchiveBodyKind,
  MailArchiveBodyQualityFlag,
  MailArchiveBodySelectionReason,
  MailArchiveSourceKind
} from '../../../../shared/mail-archive'

/** 한 메일의 정규화 결과. 자료원 경로·지문은 batch envelope가 한 번만 운반한다. */
export interface NormalizedArchiveMail {
  readonly sourceId: string
  /** EML은 자료원 루트 기준 상대 경로(단일 파일이면 ''), PST는 descriptor node id. */
  readonly itemKey: string
  readonly identityKey: string
  readonly folderPath: string | null
  readonly sentAt: number | null
  readonly from: string
  readonly to: string
  readonly cc: string
  readonly subject: string
  readonly bodyText: string
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
  readonly messageId: string | null
  readonly inReplyTo: string | null
  readonly references: string | null
  readonly attachments: readonly Omit<MailArchiveAttachment, 'id'>[]
}

/** main이 OS 선택기에서 받은 입력. renderer는 경로를 보내지 않는다. */
export interface MailArchiveImportRequest {
  readonly inputKind: 'files' | 'eml-folder'
  readonly paths: readonly string[]
}

/** 한 자료원(PST 파일, EML 파일 또는 EML 폴더)과 그 안에서 읽을 파일들. */
export interface ArchiveImportSource {
  readonly sourceId: string
  readonly kind: MailArchiveSourceKind
  readonly root: string
  readonly files: readonly { readonly path: string; readonly itemKey: string }[]
}

export interface MailArchiveAttachmentLocation {
  readonly sourceKind: MailArchiveSourceKind
  /** 읽을 원본 파일(EML 폴더 자료원이면 루트와 상대 경로를 합친 파일). */
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
