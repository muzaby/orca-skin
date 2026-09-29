import { readdir, realpath, stat } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { archiveSourceId } from './identity'
import type { ArchiveImportSource, MailArchiveImportRequest } from './types'

export function sourceKindForPath(path: string): 'eml' | 'pst' | null {
  const extension = extname(path).toLowerCase()
  if (extension === '.eml') return 'eml'
  if (extension === '.pst') return 'pst'
  return null
}

/** 폴더 아래 `.eml`을 안정된 순서로 모은다. 심볼릭 링크·junction은 따라가지 않는다. */
export async function collectEmlFiles(root: string): Promise<string[]> {
  const result: string[] = []
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile() && sourceKindForPath(path) === 'eml') result.push(path)
    }
  }
  await walk(root)
  return result
}

async function canonical(path: string): Promise<string> {
  return realpath(resolve(path)).catch(() => resolve(path))
}

/** EML 폴더는 자료원 하나이고, 파일은 루트 기준 `/` 구분 상대 경로로 식별한다. */
export async function resolveImportSources(
  request: MailArchiveImportRequest
): Promise<ArchiveImportSource[]> {
  if (request.inputKind === 'eml-folder') {
    if (request.paths.length !== 1) throw new Error('eml_folder_requires_one_path')
    const root = await canonical(request.paths[0]!)
    if (!(await stat(root).catch(() => null))?.isDirectory())
      throw new Error('eml_folder_not_found')
    const files = await collectEmlFiles(root)
    if (files.length === 0) throw new Error('eml_folder_empty')
    return [
      {
        sourceId: archiveSourceId('eml', root),
        kind: 'eml',
        root,
        files: files.map((path) => ({ path, itemKey: relative(root, path).split(sep).join('/') }))
      }
    ]
  }

  const sources: ArchiveImportSource[] = []
  for (const rawPath of request.paths) {
    const path = await canonical(rawPath)
    if (!(await stat(path).catch(() => null))?.isFile()) throw new Error('mail_source_not_found')
    const kind = sourceKindForPath(path)
    if (!kind) throw new Error('mail_source_unsupported')
    sources.push({
      sourceId: archiveSourceId(kind, path),
      kind,
      root: path,
      files: [{ path, itemKey: '' }]
    })
  }
  return sources.sort((left, right) =>
    left.root.localeCompare(right.root, undefined, { numeric: true })
  )
}
