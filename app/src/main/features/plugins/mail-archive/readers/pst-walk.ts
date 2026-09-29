import type { PSTMessage } from 'pst-extractor'

export interface PstFolderLike {
  readonly displayName?: string
  readonly hasSubfolders?: boolean
  readonly emailCount?: number
  readonly contentCount?: number
  getSubFolders(): PstFolderLike[]
  getNextChild(): unknown
}

export function isPstMail(value: unknown): value is PSTMessage {
  if (typeof value !== 'object' || value === null || !('messageClass' in value)) return false
  const messageClass = value.messageClass
  return typeof messageClass === 'string' && /^IPM\.Note(?:\.|$)/i.test(messageClass)
}

/** Counts can be -1 in pst-extractor's damaged-table fallback. Only null means EOF. */
export async function walkPstMail(
  folder: PstFolderLike,
  onMessage: (message: PSTMessage, folderPath: string) => Promise<void> | void,
  signal?: AbortSignal,
  path = '',
  onSkipped?: () => void
): Promise<void> {
  let expected: number | undefined
  let observed = 0
  try {
    const tableCount = folder.emailCount
    expected = tableCount !== undefined && tableCount >= 0 ? tableCount : folder.contentCount
  } catch {
    throw new Error('mail_pst_folder_read_failed')
  }
  for (;;) {
    signal?.throwIfAborted()
    let candidate: unknown
    try {
      candidate = folder.getNextChild()
    } catch {
      // Do not promote a partial container as a verified revision.
      throw new Error('mail_pst_folder_read_failed')
    }
    if (candidate == null) break
    observed += 1
    if (isPstMail(candidate)) await onMessage(candidate, path)
    else onSkipped?.()
  }
  // The library itself may catch an invalid child and advance its cursor. Detect that skip too.
  if (expected !== undefined && expected >= 0 && observed !== expected) {
    throw new Error('mail_pst_folder_read_failed')
  }
  if (!folder.hasSubfolders) return
  let children: PstFolderLike[]
  try {
    children = folder.getSubFolders()
  } catch {
    throw new Error('mail_pst_subfolders_read_failed')
  }
  for (const child of children) {
    const name = child.displayName?.trim() || '폴더'
    await walkPstMail(child, onMessage, signal, path ? `${path}/${name}` : name, onSkipped)
  }
}
