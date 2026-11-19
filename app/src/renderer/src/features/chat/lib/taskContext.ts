import { directoryIdentity } from '../../../../../shared/extra-directories'
import { isAbsolutePath, isFilesystemRoot } from '../../../../../shared/absolute-path'

export interface TaskContextDirectory {
  path: string
  working: boolean
}

export type TaskContextSource =
  | { kind: 'web'; url: string; title: string }
  | { kind: 'file'; path: string }
  | { kind: 'attachment'; attachmentId: string; name: string; image: boolean; path?: string }

export function taskContextDirectories(
  cwd: string | null,
  extraDirs: readonly string[]
): TaskContextDirectory[] {
  const seen = new Set<string>()
  return [
    ...(cwd ? [{ path: cwd, working: true }] : []),
    ...extraDirs.map((path) => ({ path, working: false }))
  ].filter((directory) => {
    if (!isAbsolutePath(directory.path) || isFilesystemRoot(directory.path)) return false
    const key = directoryIdentity(directory.path)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
