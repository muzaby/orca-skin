import type { GitDiffFileContent } from '../../../../../../shared/ipc'

// 열어 본 파일 본문의 **사용순 LRU**(0211 D-061). 같은 파일을 다시 열면 IPC 조회가 0건이다.
//
// 키는 `diffPeekBodyKey` 를 그대로 쓴다 — 다섯 축(cwd · sessionId · 요약 세대 · group · path)을
// 이미 그 함수가 정의하고 있어서, 여기서 두 번째 파생을 만들면 두 키가 조용히 갈라진다.
//
// **실패는 담지 않는다**: `unavailable` 을 캐시하면 일시적 실패가 세대가 바뀔 때까지 고착된다.
// 그 판정은 `putDiffBody` 안에 있고 호출부가 잊을 수 없다.

export const DIFF_BODY_CACHE_LIMIT = 12

export interface DiffBodyCacheEntry {
  key: string
  content: GitDiffFileContent
}

/** 가장 오래 **안 쓴** 것이 앞, 방금 쓴 것이 뒤다. */
export type DiffBodyCache = readonly DiffBodyCacheEntry[]

export const EMPTY_DIFF_BODY_CACHE: DiffBodyCache = []

export function getDiffBody(cache: DiffBodyCache, key: string): GitDiffFileContent | null {
  return cache.find((entry) => entry.key === key)?.content ?? null
}

/**
 * 읽기가 **사용순을 바꾼다** — LRU 는 삽입순이 아니라 사용순이다. 방금 읽은 항목을 뒤로
 * 옮기지 않으면 오래 쓰던 파일이 열두 번째 진입에서 밀려난다.
 */
export function touchDiffBody(cache: DiffBodyCache, key: string): DiffBodyCache {
  const found = cache.find((entry) => entry.key === key)
  if (!found) return cache
  return [...cache.filter((entry) => entry.key !== key), found]
}

export function putDiffBody(
  cache: DiffBodyCache,
  key: string,
  content: GitDiffFileContent
): DiffBodyCache {
  // 텍스트 본문만 남긴다. `binary`·`unavailable` 은 다음 진입이 다시 시도해야 한다.
  if (content.kind !== 'text') return cache
  const next = [...cache.filter((entry) => entry.key !== key), { key, content }]
  return next.length > DIFF_BODY_CACHE_LIMIT
    ? next.slice(next.length - DIFF_BODY_CACHE_LIMIT)
    : next
}
