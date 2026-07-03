// 디렉토리 한 단계 리스팅 — Composer 의 `@` 파일 경로 자동완성용.
// `<cwd>/<relDir>` 의 직속 항목만 반환. 재귀 스캔이나 fuzzy 검색은 v1 범위 밖.

import { promises as fs } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { FileEntry } from '../../../shared/ipc'

// path traversal 방어: resolve 결과가 cwd 의 prefix 가 아니면 거부.
// `path.sep` 으로 끝나는 비교 prefix 를 사용해 `/foo` 와 `/foobar` 혼동을 막는다.
function isInsideCwd(target: string, cwd: string): boolean {
  const cwdRoot = cwd.endsWith(sep) ? cwd : cwd + sep
  return target === cwd || target.startsWith(cwdRoot)
}

export async function listDir(cwd: string, relDir: string): Promise<FileEntry[]> {
  const target = resolve(cwd, relDir)
  if (!isInsideCwd(target, cwd)) return []
  const dirents = await fs.readdir(target, { withFileTypes: true }).catch(() => [])
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
