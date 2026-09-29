import type { PSTMessage } from 'pst-extractor'
import { normalizePst } from '../normalize'
import type { NormalizedArchiveMail } from '../types'

export interface PstFolderLike {
  readonly displayName?: string
  readonly hasSubfolders?: boolean
  getSubFolders(): PstFolderLike[]
  getNextChild(): unknown
}

/** 읽지 못한 폴더. 조용히 버리지 않고 가져오기 결과에 보고한다. */
export interface PstWalkReport {
  readonly unreadableFolders: string[]
  unreadableMessages: number
}

/** 메일 항목만 받는다. 일정·연락처·작업도 PSTMessage를 상속하므로 message class로 거른다. */
function isMailItem(value: unknown): value is PSTMessage {
  if (typeof value !== 'object' || value === null || !('descriptorNodeId' in value)) return false
  const messageClass = String(
    (value as { messageClass?: unknown }).messageClass ?? ''
  ).toLocaleLowerCase('en-US')
  return messageClass.startsWith('ipm.note') || messageClass.startsWith('report.ipm.note')
}

function childPath(parent: string, folder: PstFolderLike): string {
  const name = folder.displayName?.trim() || '폴더'
  return parent ? `${parent}/${name}` : name
}

/**
 * `getNextChild()`가 null을 낼 때까지 읽는다. 목차가 손상된 폴더는 라이브러리가 descriptor
 * B-tree로 대체하는데 이때 `emailCount`는 -1이므로 개수로 반복 상한을 잡지 않는다.
 */
export function* walkPstMessages(
  folder: PstFolderLike,
  report: PstWalkReport,
  signal?: AbortSignal,
  path = ''
): Generator<{ readonly message: PSTMessage; readonly folderPath: string }> {
  signal?.throwIfAborted()
  try {
    for (let child = folder.getNextChild(); child; child = folder.getNextChild()) {
      signal?.throwIfAborted()
      if (isMailItem(child)) yield { message: child, folderPath: path }
    }
  } catch (error) {
    if (signal?.aborted) throw error
    report.unreadableFolders.push(path || '/')
  }
  if (!folder.hasSubfolders) return
  let children: PstFolderLike[]
  try {
    children = folder.getSubFolders()
  } catch (error) {
    if (signal?.aborted) throw error
    report.unreadableFolders.push(`${path || '/'} (하위 폴더)`)
    return
  }
  for (const child of children)
    yield* walkPstMessages(child, report, signal, childPath(path, child))
}

export async function openPst<T>(
  path: string,
  read: (root: PstFolderLike) => Promise<T>
): Promise<T> {
  const { PSTFile } = await import('pst-extractor')
  const pst = new PSTFile(path)
  try {
    return await read(pst.getRootFolder() as unknown as PstFolderLike)
  } finally {
    pst.close()
  }
}

export async function readPstFile(options: {
  readonly sourcePath: string
  readonly sourceId: string
  readonly signal?: AbortSignal
  readonly onMessage: (message: NormalizedArchiveMail) => Promise<void> | void
}): Promise<PstWalkReport & { readonly messages: number }> {
  options.signal?.throwIfAborted()
  const report: PstWalkReport = { unreadableFolders: [], unreadableMessages: 0 }
  let messages = 0
  await openPst(options.sourcePath, async (root) => {
    for (const { message, folderPath } of walkPstMessages(root, report, options.signal)) {
      let normalized: NormalizedArchiveMail
      try {
        normalized = normalizePst(message, {
          sourceId: options.sourceId,
          folderPath,
          itemKey: message.descriptorNodeId.toString()
        })
      } catch {
        // 손상된 메시지 하나가 PST 전체를 실패시키지 않게 하되, 개수는 보고한다.
        report.unreadableMessages += 1
        continue
      }
      await options.onMessage(normalized)
      messages += 1
    }
  })
  return { ...report, messages }
}
