import { promises as fs } from 'node:fs'
import { extname } from 'node:path'
import { isAbsolutePath, isFilesystemRoot } from '../../../shared/absolute-path'
import { directoryIdentity } from '../../../shared/extra-directories'
import { isWithinDir } from '../../infra/config/paths'
import { unredirectedFile } from '../../infra/config/real-file'

export interface ContextFileScope {
  recordedContextDirectories(sessionId: string): string[]
  recordedAttachmentFiles(sessionId: string): string[]
}

export type ContextFileResolution = { state: 'missing' } | { state: 'file'; target: string }

export const CONTEXT_FILE_OPEN_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'webp',
  'tif',
  'tiff',
  'txt',
  'md',
  'markdown',
  'log',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'xml',
  'yaml',
  'yml'
])

export function opensWithDefaultApp(target: string): boolean {
  return CONTEXT_FILE_OPEN_EXTENSIONS.has(extname(target).slice(1).toLowerCase())
}

export async function resolveContextFile(
  scope: ContextFileScope,
  sessionId: string,
  path: string
): Promise<ContextFileResolution> {
  if (!isAbsolutePath(path) || isFilesystemRoot(path)) throw new Error('허용되지 않은 경로입니다.')
  const directories = scope.recordedContextDirectories(sessionId)
  const attachments = scope.recordedAttachmentFiles(sessionId)
  if (directories.length === 0 && attachments.length === 0)
    throw new Error('허용되지 않은 경로입니다.')
  const lexicalMember =
    directories.some((directory) => isWithinDir(path, directory)) ||
    attachments.some((attachment) => directoryIdentity(attachment) === directoryIdentity(path))
  try {
    await fs.stat(path)
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      if (!lexicalMember) throw new Error('허용되지 않은 경로입니다.')
      return { state: 'missing' }
    }
    throw error
  }
  const target = await fs.realpath(path)
  const stat = await fs.stat(target).catch(() => null)
  if (!stat?.isFile()) throw new Error('파일만 열 수 있습니다.')
  const unredirectedTarget = await unredirectedFile(path).catch(() => null)
  const verifiedDirectories = await Promise.all(
    directories.map(async (directory) => {
      // 실제 표기 별칭만 문자열 범위를 우회한다. 외부 junction은 승인된 경로가 아니다.
      if (!isWithinDir(path, directory) && unredirectedTarget === null) return null
      const actual = await fs.realpath(directory).catch(() => null)
      if (!actual || isFilesystemRoot(actual) || !isWithinDir(target, actual)) return null
      const directoryStat = await fs.stat(actual).catch(() => null)
      return directoryStat?.isDirectory() ? directoryIdentity(directory) : null
    })
  )
  const verifiedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      const actual = await unredirectedFile(attachment).catch(() => null)
      return unredirectedTarget && actual && directoryIdentity(actual) === directoryIdentity(target)
        ? directoryIdentity(attachment)
        : null
    })
  )
  // 비동기 파일 검사 뒤에도 같은 세션에 남아 있는 승인 범위만 사용한다.
  if (
    !scope
      .recordedContextDirectories(sessionId)
      .some((directory) => verifiedDirectories.includes(directoryIdentity(directory))) &&
    !scope
      .recordedAttachmentFiles(sessionId)
      .some((attachment) => verifiedAttachments.includes(directoryIdentity(attachment)))
  )
    throw new Error('허용되지 않은 경로입니다.')
  return { state: 'file', target }
}
