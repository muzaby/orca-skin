import { isAbsolutePath, isFilesystemRoot } from './absolute-path'

// 명시적 폴더 추가 명령의 상한. 이미 저장된 레거시 목록을 잘라내지 않는다.
export const MAX_SESSION_EXTRA_DIRECTORIES = 32

export function directoryIdentity(directory: string): string {
  const normalized = directory.replace(/\\/g, '/').replace(/\/$/, '')
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized
}

// DB 복원과 턴 준비가 같은 경로 집합을 사용한다. 손상/상대/루트 항목은 허용하지 않는다.
export function parseStoredExtraDirectories(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (value): value is string =>
        typeof value === 'string' && isAbsolutePath(value) && !isFilesystemRoot(value)
    )
  } catch {
    return []
  }
}

export function sameExtraDirectories(
  left: readonly string[] = [],
  right: readonly string[] = []
): boolean {
  const leftKeys = new Set(left.map(directoryIdentity))
  const rightKeys = new Set(right.map(directoryIdentity))
  return leftKeys.size === rightKeys.size && [...leftKeys].every((key) => rightKeys.has(key))
}
