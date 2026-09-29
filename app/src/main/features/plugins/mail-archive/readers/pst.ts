import { stat } from 'node:fs/promises'
import { walkPstMail } from './pst-walk'
import { normalizePst } from '../normalize'
import type { NormalizedArchiveMail } from '../types'

export interface PstReadOptions {
  readonly sourcePath: string
  readonly sourceId: string
  readonly sourceFingerprint: string
  readonly signal?: AbortSignal
  readonly onSkipped?: () => void
  readonly onMessage: (message: NormalizedArchiveMail) => Promise<void> | void
}

export async function readPstFile(options: PstReadOptions): Promise<number> {
  options.signal?.throwIfAborted()
  const fileStat = await stat(options.sourcePath)
  // pst-extractor opens the path lazily and supports ANSI/Unicode PST variants. The file-size
  // guard is intentionally only informational here; the import job remains cancellable between
  // messages and never copies the PST into the archive database.
  const sizeBytes = fileStat.size
  const { PSTFile } = await import('pst-extractor')
  const pst = new PSTFile(options.sourcePath)
  let count = 0
  try {
    await walkPstMail(
      pst.getRootFolder(),
      async (candidate, folderPath) => {
        const message = normalizePst(candidate, {
          sourceId: options.sourceId,
          sourcePath: options.sourcePath,
          sourceFingerprint: options.sourceFingerprint,
          folderPath,
          itemKey: candidate.descriptorNodeId.toString(),
          sizeBytes
        })
        await options.onMessage(message)
        count += 1
      },
      options.signal,
      '',
      options.onSkipped
    )
    return count
  } finally {
    pst.close()
  }
}
