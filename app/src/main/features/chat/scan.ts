// 디렉토리 한 단계 리스팅 — Composer 의 `@` 파일 경로 자동완성용.
// `<cwd>/<relDir>` 의 직속 항목만 반환. 재귀 스캔이나 fuzzy 검색은 v1 범위 밖.

import { promises as fs } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { FileEntry } from '../../../shared/ipc'

// path traversal 방어: resolve 결과가 cwd 의 prefix 가 아니면 거부.
// `path.sep` 으로 끝나는 비교 prefix 를 사용해 `/foo` 와 `/foobar` 혼동을 막는다.
function isInsideCwd(target: string, cwd: string): boolean {
  const offset = relative(cwd, target)
  return offset !== '..' && !offset.startsWith('..' + sep) && !isAbsolute(offset)
}

export function folderPath(cwd: string, relDir: string): string | null {
  if (!isAbsolute(cwd)) return null
  const target = resolve(cwd, relDir)
  return isInsideCwd(target, cwd) ? target : null
}

export async function resolveFolder(cwd: string, target: string): Promise<string> {
  const [root, folder] = await Promise.all([fs.realpath(cwd), fs.realpath(target)])
  if (!isInsideCwd(folder, root)) throw new Error('Folder is outside the working directory')
  return folder
}

export async function listDir(cwd: string, relDir: string): Promise<FileEntry[]> {
  const target = folderPath(cwd, relDir)
  if (target === null) return []
  const dirents = await resolveFolder(cwd, target)
    .then((folder) => fs.readdir(folder, { withFileTypes: true }))
    .catch(() => [])
  const result: FileEntry[] = []
  for (const d of dirents) {
    if (d.isSymbolicLink()) continue
    const isDir = d.isDirectory()
    if (!isDir && !d.isFile()) continue
    result.push({ name: d.name, isDirectory: isDir })
  }
  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return result
}
