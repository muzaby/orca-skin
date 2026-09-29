import type { MailArchiveSourceKind } from '../../../../shared/mail-archive'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveAttachmentExportOutput,
  NormalizedArchiveMail
} from './types'

/** 원본 파일 하나를 읽는 작업. EML 폴더 자료원은 파일마다 하나씩 보낸다. */
export interface MailArchiveSourceInput {
  readonly jobId: string
  readonly epoch: string
  readonly sourceId: string
  readonly sourceKind: MailArchiveSourceKind
  readonly path: string
  readonly itemKey: string
}

export type MailArchiveSourceDecision =
  { readonly action: 'scan'; readonly revision: number } | { readonly action: 'skip' }

export interface MailArchiveSourceCompletion {
  readonly revision: number | null
  readonly messages: number
  readonly skipped: boolean
  /** 읽지 못한 폴더·메시지처럼 가져오기는 계속했지만 알려야 하는 사유. */
  readonly warnings: readonly string[]
}

/** source job이 main과 주고받는 두 단계. 전송(utility process 메시지)은 구현이 정한다. */
export interface MailArchiveSourceChannel {
  ready(fingerprint: string): Promise<MailArchiveSourceDecision>
  /** index가 batch를 commit하고 확인할 때 resolve된다. */
  batch(revision: number, mails: readonly NormalizedArchiveMail[]): Promise<void>
}

export interface MailArchiveSourceWorker {
  run(
    input: MailArchiveSourceInput,
    channel: MailArchiveSourceChannel,
    signal: AbortSignal
  ): Promise<MailArchiveSourceCompletion>
  extract(input: MailArchiveAttachmentExportInput): Promise<MailArchiveAttachmentExportOutput>
  /** 가져오기 작업이 끝나면 프로세스를 내린다. */
  dispose(): void
}
