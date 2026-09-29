import { createMailArchiveBatchBuffer } from './batch-buffer'
import { parseEml, readEmlBytes } from './readers/eml'
import { bufferFingerprint, fileFingerprint } from './readers/fingerprint'
import { readPstFile } from './readers/pst'
import type { NormalizedArchiveMail } from './types'
import type {
  MailArchiveSourceChannel,
  MailArchiveSourceCompletion,
  MailArchiveSourceInput
} from './worker-contract'

const SKIPPED: MailArchiveSourceCompletion = {
  revision: null,
  messages: 0,
  skipped: true,
  warnings: []
}

/**
 * 원본 파일 하나를 지문 → 결정 → batch 전송 순서로 처리한다. source utility process가 실행하며,
 * 전송을 channel로 받아 프로세스 없이도 같은 코드를 테스트한다.
 */
export async function runSourceJob(
  input: MailArchiveSourceInput,
  channel: MailArchiveSourceChannel,
  signal: AbortSignal,
  readPst: typeof readPstFile = readPstFile
): Promise<MailArchiveSourceCompletion> {
  signal.throwIfAborted()
  if (input.sourceKind === 'eml') {
    // 한 번 읽은 바이트를 지문과 파싱에 함께 쓴다 — 읽는 사이에 파일이 바뀔 틈이 없다.
    const bytes = await readEmlBytes(input.path)
    const decision = await channel.ready(bufferFingerprint(bytes))
    if (decision.action === 'skip') return SKIPPED
    signal.throwIfAborted()
    await channel.batch(decision.revision, [
      await parseEml(bytes, { sourceId: input.sourceId, itemKey: input.itemKey })
    ])
    return { revision: decision.revision, messages: 1, skipped: false, warnings: [] }
  }

  // PST는 파싱하며 디스크에서 읽으므로 시작·완료 지문이 같을 때만 revision을 검증한다.
  const startFingerprint = await fileFingerprint(input.path, signal)
  const decision = await channel.ready(startFingerprint)
  if (decision.action === 'skip') return SKIPPED
  const batcher = createMailArchiveBatchBuffer<NormalizedArchiveMail>((mails) =>
    channel.batch(decision.revision, mails)
  )
  const report = await readPst({
    sourcePath: input.path,
    sourceId: input.sourceId,
    signal,
    onMessage: (mail) => batcher.push(mail)
  })
  await batcher.flush()
  if ((await fileFingerprint(input.path, signal)) !== startFingerprint) {
    throw new Error('mail_source_changed_during_import')
  }
  return {
    revision: decision.revision,
    messages: report.messages,
    skipped: false,
    warnings: [
      ...(report.unreadableFolders.length > 0
        ? [`mail_pst_folders_unreadable:${report.unreadableFolders.length}`]
        : []),
      ...(report.unreadableMessages > 0
        ? [`mail_pst_messages_unreadable:${report.unreadableMessages}`]
        : [])
    ]
  }
}
