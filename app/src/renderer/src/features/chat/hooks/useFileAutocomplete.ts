import { useEffect, useMemo, useState } from 'react'
import type { FileEntry } from '../../../../../shared/ipc'
import { fileApi } from '../../../shared/api/ipc'
import { useTokenAutocompleteState } from './useTokenAutocompleteState'

// caret 직전의 `@<partial>` 매칭. 두 형태 모두 지원:
// - quoted (미닫힘 포함): `@"foo bar/` — 공백 포함 경로 진행 중
// - plain: `@foo` — 공백/따옴표 없는 일반 경로
// quoted 우선 매치하여 미닫힘 quote 안에서도 디렉토리 진입 가능하게 한다.
const FILE_PARTIAL_QUOTED_RE = /(?:^|\s)@"([^"\n]*)$/
const FILE_PARTIAL_PLAIN_RE = /(?:^|\s)@([^\s"]*)$/

export interface UseFileAutocomplete {
  open: boolean
  // 첫 IPC 응답 전이거나 dirPath 가 바뀌어 재조회 중이면 true. picker 가 즉시
  // 뜨도록 open 은 별도로 분리하고, 본문은 loading/empty 상태로 분기 렌더한다.
  loading: boolean
  // 현재 보여줄 디렉토리 (cwd 기준 상대, '' = cwd 직속). picker 헤더에 표시.
  dirPath: string
  // 디렉토리 내에서 prefix 필터링된 후보 (최대 8개).
  suggestions: FileEntry[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  // caret 좌측 토큰의 시작 인덱스. plain 은 `@`, quoted 는 `@"` 위치.
  tokenStart: number
  // 매칭이 quoted partial 이면 true — applyFileAutocomplete 가 닫는 quote 를
  // 자동 보강해야 하는 케이스인지 식별용.
  quoted: boolean
  // quoted partial 이면서 caret 직후 첫 문자가 `"` 인 경우 true — 사용자가 quote
  // 쌍 안으로 caret 을 이동해 picker 가 재오픈된 상태. applyFileAutocomplete 가
  // 새 닫는 quote 를 만들지 않고 기존 것을 재사용하도록 분기.
  hasClosingQuote: boolean
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
  const match = useMemo(() => {
    const before = text.slice(0, caret)
    // quoted 우선 — `@"abc def` 까지 입력된 경우 plain 매치가 `@` 빈 부분만 잡지
    // 못하게 막는다 (plain RE 가 `"` 를 제외하므로 자연스럽게 quoted 만 매치).
    const q = before.match(FILE_PARTIAL_QUOTED_RE)
    if (q) {
      const partial = q[1]
      // `@"` 가 두 문자 — partial 길이 + 2 만큼 앞이 token 시작점.
      const tokenStart = caret - partial.length - 2
      const { dirPath, prefix } = splitDirAndPrefix(partial)
      return { partial, tokenStart, dirPath, prefix, quoted: true }
    }
    const p = before.match(FILE_PARTIAL_PLAIN_RE)
    if (!p) return null
    const partial = p[1]
    const tokenStart = caret - partial.length - 1
    const { dirPath, prefix } = splitDirAndPrefix(partial)
    return { partial, tokenStart, dirPath, prefix, quoted: false }
  }, [text, caret])

  // dirPath 별 캐시 — 같은 디렉토리는 1회만 listing.
  const [entriesByDir, setEntriesByDir] = useState<Map<string, FileEntry[]>>(new Map())
  // 검증된 cwd-상대 fullpath 누적 (chip 강조용). 디렉토리는 `path/` 형태로, 파일은
  // `path` 형태로 저장.
  const [validPaths, setValidPaths] = useState<ReadonlySet<string>>(() => new Set())

  // cwd 가 바뀌면 이전 폴더 기준 리스팅/검증 캐시를 폐기한다 — 상대 dir 키(예 '')가 같아도
  // 새 cwd 로 재조회하게 한다. effect 가 아니라 렌더 중 "이전 prop 비교" 패턴으로 초기화해
  // stale 응답이 커밋·표시되기 전에 비운다(랜딩 cwd 변경[0057]·세션 전환 등 모든 cwd 전이 커버).
  const [cachedCwd, setCachedCwd] = useState(cwd)
  if (cwd !== cachedCwd) {
    setCachedCwd(cwd)
    setEntriesByDir(new Map())
    setValidPaths(new Set())
  }

  // dirPath 가 바뀔 때마다 listing — cancelled 플래그로 stale 응답 무시.
  useEffect(() => {
    if (!cwd || !match) return
    const dir = match.dirPath
    if (entriesByDir.has(dir)) return
    let cancelled = false
    void fileApi.list(cwd, dir).then((entries) => {
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
  // 활성 인덱스 보정 + Escape 해제/재오픈은 공유 상태 머신(useTokenAutocompleteState).
  const { activeIndex, setActiveIndex, dismissed, close } = useTokenAutocompleteState(
    partial,
    suggestions.length
  )
  // suggestions 가 비어도 picker 가 보이도록 — 로딩/빈 결과 안내를 노출하기 위함.
  const open = cwd !== null && match !== null && !dismissed
  // 첫 응답 전(또는 dirPath 변경 후 재조회 중) 이면 loading. 빈 응답이 도착하면
  // Map 에 빈 배열이 set 되어 has() = true → loading=false 로 자연 전환.
  const loading = match !== null && cwd !== null && !entriesByDir.has(match.dirPath)
  // caret 이 닫는 quote 직전인지 — 기존 quote 쌍 안에서 재오픈된 상태.
  const hasClosingQuote = match?.quoted === true && text[caret] === '"'

  return {
    open,
    loading,
    dirPath: match?.dirPath ?? '',
    suggestions,
    activeIndex,
    setActiveIndex,
    tokenStart: match?.tokenStart ?? -1,
    quoted: match?.quoted ?? false,
    hasClosingQuote,
    validPaths,
    close
  }
}
