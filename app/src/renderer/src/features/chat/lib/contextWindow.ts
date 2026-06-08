// Claude 기반 — 컨텍스트 윈도우(토큰). 기본 200k, 사용 모델명에 '1m' 글자가 포함되면 1M(컨텍스트
// 1M 변종). 모델 문자열만으로 판정하므로 정적 맵/환경변수 불필요.
export const DEFAULT_CONTEXT_WINDOW = 200_000

export function contextWindowFor(model?: string): number {
  return model && model.toLowerCase().includes('1m') ? 1_000_000 : DEFAULT_CONTEXT_WINDOW
}
