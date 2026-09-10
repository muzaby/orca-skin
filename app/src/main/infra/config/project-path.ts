import { posix, win32 } from 'node:path'
import { isAbsolutePath, isFilesystemRoot } from '../../../shared/absolute-path'
import { directoryIdentity } from '../../../shared/extra-directories'

/** Lexical OS path identity. Symlinks remain the path the user selected. */
export function projectPath(directory: string): { cwd: string; key: string; name: string } {
  if (!isAbsolutePath(directory)) throw new Error('프로젝트 경로는 절대 경로여야 합니다.')
  const paths = /^[a-z]:[\\/]|^[\\/]{2}/i.test(directory) ? win32 : posix
  const normalized = paths.normalize(directory)
  if (isFilesystemRoot(normalized)) throw new Error('프로젝트 경로로 루트 폴더를 쓸 수 없습니다.')
  const cwd = normalized.replace(/[\\/]+$/, '')
  return { cwd, key: directoryIdentity(cwd), name: paths.basename(cwd) }
}
