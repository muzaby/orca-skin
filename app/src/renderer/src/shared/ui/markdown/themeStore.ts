// data-theme 속성 구독 싱글톤(0108) — CodeBlock 인스턴스마다 documentElement 에
// MutationObserver 를 붙이지 않고, 모듈 스코프 observer 1개를 useSyncExternalStore 로
// 공유한다. 테마 토글 시 구독자에게만 통지.

export type ShikiThemeId = 'github-light' | 'github-dark'

function pickTheme(): ShikiThemeId {
  if (typeof document === 'undefined') return 'github-light'
  return document.documentElement.dataset.theme === 'dark' ? 'github-dark' : 'github-light'
}

let current: ShikiThemeId = pickTheme()
const listeners = new Set<() => void>()
let observer: MutationObserver | null = null

function ensureObserver(): void {
  if (observer !== null || typeof MutationObserver === 'undefined') return
  // 모듈 로드~첫 구독 사이의 테마 변경을 흡수 — observer 는 이후 변경만 감지한다.
  current = pickTheme()
  observer = new MutationObserver(() => {
    const next = pickTheme()
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
}

export function subscribeTheme(listener: () => void): () => void {
  ensureObserver()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getThemeSnapshot(): ShikiThemeId {
  return current
}
