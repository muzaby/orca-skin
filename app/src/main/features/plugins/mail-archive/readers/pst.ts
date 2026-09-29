import { stat } from 'node:fs/promises'
import type { PSTMessage } from 'pst-extractor'
import { normalizePst } from '../normalize'
import type { NormalizedArchiveMail } from '../types'

export interface PstReadOptions {
  readonly sourcePath: string
  readonly sourceFingerprint: string
  readonly signal?: AbortSignal
  readonly onMessage: (message: NormalizedArchiveMail) => Promise<void> | void
}

type PstFolderLike = {
  readonly displayName?: string
  readonly hasSubfolders?: boolean
  readonly contentCount?: number
  readonly emailCount?: number
  getSubFolders(): PstFolderLike[]
  getNextChild(): unknown
}

function isPstMessage(value: unknown): value is PSTMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'subject' in value &&
    'body' in value &&
    'descriptorNodeId' in value &&
    typeof (value as { descriptorNodeId?: { toString(): string } }).descriptorNodeId?.toString ===
      'function'
  )
}

function folderName(parent: string, folder: PstFolderLike): string {
  const name = folder.displayName?.trim() || '폴더'
  return parent ? `${parent}/${name}` : name
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
  const visit = async (folder: PstFolderLike, path: string): Promise<void> => {
    options.signal?.throwIfAborted()
    const currentPath = path
    const emailCount = Math.max(0, folder.emailCount ?? folder.contentCount ?? 0)
    for (let index = 0; index < emailCount; index += 1) {
      options.signal?.throwIfAborted()
      let candidate: unknown
      try {
        candidate = folder.getNextChild()
      } catch {
        // A damaged folder can expose an invalid B-tree row. Preserve messages already read from
        // this folder and continue with the next sibling instead of discarding the whole PST.
        break
      }
      if (!isPstMessage(candidate)) continue
      const message = normalizePst(candidate, {
        sourcePath: options.sourcePath,
        sourceFingerprint: options.sourceFingerprint,
        folderPath: currentPath,
        itemKey: candidate.descriptorNodeId.toString(),
        sizeBytes
      })
      await options.onMessage(message)
      count += 1
    }
    if (folder.hasSubfolders) {
      let children: PstFolderLike[]
      try {
        children = folder.getSubFolders()
      } catch {
        // pst-extractor reports malformed child tables by throwing. The parent messages remain
        // searchable; an individual broken subtree is reported by the job at file granularity.
        return
      }
      for (const child of children) {
        await visit(child, folderName(currentPath, child))
      }
    }
  }
  try {
    const root = pst.getRootFolder() as unknown as PstFolderLike
    await visit(root, '')
    return count
  } finally {
    pst.close()
  }
}
