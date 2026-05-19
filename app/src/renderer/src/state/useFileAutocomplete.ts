import { useEffect, useMemo, useState } from 'react'
import type { FileEntry } from '../../../shared/ipc'

// caret 직전의 `@<partial>` 매칭. partial 은 공백을 제외한 모든 문자 허용 (`/` 포함).
// 줄 시작 또는 공백 다음의 `@` 만 매치하여 이메일 등 중간 `@` 와 충돌하지 않게.
const FILE_PARTIAL_RE = /(?:^|\s)@([^\s]*)$/

export interface UseFileAutocomplete {
  open: boolean
  // 현재 보여줄 디렉토리 (cwd 기준 상대, '' = cwd 직속). picker 헤더에 표시.
  dirPath: string
  // 디렉토리 내에서 prefix 필터링된 후보 (최대 8개).
  suggestions: FileEntry[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  // caret 좌측 `@` 의 시작 인덱스. 선택 적용 시 이 위치부터 caret 까지 잘라낸다.
  tokenStart: number
  // picker 가 listing 한 경로의 cwd-상대 fullpath 누적. HighlightedTextarea 의
  // `validFilePaths` 로 전달되어 chip 강조 대상 결정에 쓰인다.
  validPaths: ReadonlySet<string>
  close: () => void
}

function splitDirAndPrefix(partial: string): { dirPath: string; prefix: string } {
  const lastSlash = partial.lastIndexOf('/')
  if (lastSlash === -1) return { dirPath: '', prefix: partial }
  return { dirPath: partial.slice(0, lastSlash), prefix: partial.slice(lastSlash + 1) }
}

export function useFileAutocomplete(
  text: string,
  caret: number,
  cwd: string | null
): UseFileAutocomplete {
  const [rawActiveIndex, setRawActiveIndex] = useState(0)
  // Escape 로 닫은 시점의 partial. partial 이 다시 바뀌면 자동 재오픈.
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)

  const match = useMemo(() => {
    const before = text.slice(0, caret)
    const m = before.match(FILE_PARTIAL_RE)
    if (!m) return null
    const partial = m[1]
    const tokenStart = caret - partial.length - 1
    const { dirPath, prefix } = splitDirAndPrefix(partial)
    return { partial, tokenStart, dirPath, prefix }
  }, [text, caret])

  // dirPath 별 캐시 — 같은 디렉토리는 1회만 listing.
  const [entriesByDir, setEntriesByDir] = useState<Map<string, FileEntry[]>>(new Map())
  // 검증된 cwd-상대 fullpath 누적 (chip 강조용). 디렉토리는 `path/` 형태로, 파일은
  // `path` 형태로 저장.
  const [validPaths, setValidPaths] = useState<ReadonlySet<string>>(() => new Set())

  // dirPath 가 바뀔 때마다 listing — cancelled 플래그로 stale 응답 무시.
  useEffect(() => {
    if (!cwd || !match) return
    const dir = match.dirPath
    if (entriesByDir.has(dir)) return
    let cancelled = false
    void window.orca.files.list(cwd, dir).then((entries) => {
      if (cancelled) return
      setEntriesByDir((prev) => {
        const next = new Map(prev)
        next.set(dir, entries)
        return next
      })
      // 검증 캐시 갱신 — 새 토큰이 추가될 때만 set 재생성하여 chip 렌더 재평가.
      setValidPaths((prev) => {
        let next: Set<string> | null = null
        for (const e of entries) {
          const full = dir === '' ? e.name : `${dir}/${e.name}`
          const token = e.isDirectory ? `${full}/` : full
          if (!prev.has(token)) {
            if (next === null) next = new Set(prev)
            next.add(token)
          }
        }
        return next ?? prev
      })
    })
    return (): void => {
      cancelled = true
    }
  }, [cwd, match, entriesByDir])

  const suggestions = useMemo(() => {
    if (!match) return []
    const entries = entriesByDir.get(match.dirPath)
    if (!entries) return []
    const prefix = match.prefix.toLowerCase()
    const showHidden = match.prefix.startsWith('.')
    return entries
      .filter((e) => {
        if (!showHidden && e.name.startsWith('.')) return false
        return e.name.toLowerCase().startsWith(prefix)
      })
      .slice(0, 8)
  }, [entriesByDir, match])

  const partial = match?.partial ?? null
  const dismissed = dismissedAt !== null && dismissedAt === partial
  const activeIndex = rawActiveIndex >= suggestions.length ? 0 : rawActiveIndex
  const open = cwd !== null && match !== null && suggestions.length > 0 && !dismissed

  return {
    open,
    dirPath: match?.dirPath ?? '',
    suggestions,
    activeIndex,
    setActiveIndex: setRawActiveIndex,
    tokenStart: match?.tokenStart ?? -1,
    validPaths,
    close: (): void => setDismissedAt(partial)
  }
}
