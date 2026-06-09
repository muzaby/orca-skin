// Claude 기반 — 컨텍스트 윈도우(토큰). 기본 200k, 사용 모델명에 '1m' 글자가 포함되면 1M(컨텍스트
// 1M 변종). 모델 문자열만으로 판정하므로 정적 맵/환경변수 불필요.
export const DEFAULT_CONTEXT_WINDOW = 200_000

export function contextWindowFor(model?: string): number {
  return model && model.toLowerCase().includes('1m') ? 1_000_000 : DEFAULT_CONTEXT_WINDOW
}

// 자동 compaction 버퍼 — Claude Code 가 컨텍스트 윈도우 끝에서 이만큼을 남겨두고 자동 정리
// (compaction)를 트리거한다. CLI 버전·CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 환경변수에 따라 가변이라
// (과거 ~45k → 현재 ~33k) 정확한 상수가 아닌 추정값이다. /context 와 100% 일치는 불가.
export const AUTOCOMPACT_BUFFER = 33_000

// compaction 임박 여부 — 유효 한계(window - buffer)의 83.5% 를 used 가 넘어서면 곧 자동 정리.
// 윈도우가 버퍼 이하인 비정상 입력(유효 한계 ≤ 0)은 false 가드.
export function nearCompaction(used: number, window: number): boolean {
  const effectiveLimit = window - AUTOCOMPACT_BUFFER
  if (effectiveLimit <= 0) return false
  return used >= effectiveLimit * 0.835
}
