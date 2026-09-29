import { readdir, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import type { ArchiveImportSource } from './types'

const EML_EXTENSION = '.eml'
const PST_EXTENSION = '.pst'

export function sourceKindForPath(path: string): 'eml' | 'pst' | null {
  const extension = extname(path).toLowerCase()
  if (extension === EML_EXTENSION) return 'eml'
  if (extension === PST_EXTENSION) return 'pst'
  return null
}

export async function collectEmlFiles(
  root: string,
  signal?: AbortSignal
): Promise<ArchiveImportSource[]> {
  const result: ArchiveImportSource[] = []
  const walk = async (directory: string): Promise<void> => {
    signal?.throwIfAborted()
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    for (const entry of entries) {
      signal?.throwIfAborted()
      // Symlinks/junctions are intentionally skipped so an archive folder cannot recurse out of
      // its selected root or loop back into itself.
      if (entry.isSymbolicLink()) continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && sourceKindForPath(path) === 'eml') {
        result.push({ path, kind: 'eml' })
      }
    }
  }
  await walk(resolve(root))
  return result
}

export async function resolveImportSources(
  inputKind: 'files' | 'eml-folder',
  paths: readonly string[],
  signal?: AbortSignal
): Promise<ArchiveImportSource[]> {
  if (inputKind === 'eml-folder') {
    if (paths.length !== 1) throw new Error('eml_folder_requires_one_path')
    const root = resolve(paths[0]!)
    const rootStat = await stat(root).catch(() => null)
    if (!rootStat?.isDirectory()) throw new Error('eml_folder_not_found')
    return collectEmlFiles(root, signal)
  }

  const sources: ArchiveImportSource[] = []
  for (const rawPath of paths) {
    signal?.throwIfAborted()
    const path = resolve(rawPath)
    const fileStat = await stat(path).catch(() => null)
    if (!fileStat?.isFile()) throw new Error('mail_source_not_found')
    const kind = sourceKindForPath(path)
    if (!kind) throw new Error('mail_source_unsupported')
    sources.push({ path, kind })
  }
  return sources.sort((left, right) =>
    left.path.localeCompare(right.path, undefined, { numeric: true })
  )
}
