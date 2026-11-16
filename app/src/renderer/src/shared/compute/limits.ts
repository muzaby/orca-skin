// 계산 워커와 UI 스레드 사이의 상한 (0324 D-008·D-012·D-014). 수치의 근거는
// docs/decisions/012-execution-contexts.md.

// 이 글자 수 이하의 코드에만 구문 강조를 요청한다 — 강조 결과를 DOM 에 넣는 일은 UI 스레드에 남는다.
export const HIGHLIGHT_MAX_CHARS = 32_000
// 두 입력의 줄 수 합이 이 값 이하면 diff 줄 계산을 UI 스레드에서 한다. 넘으면 워커가 한다.
export const DIFF_INLINE_MAX_LINES = 400
// 이 글자 수를 넘는 unified patch 는 UI 스레드에서 파싱하지 않는다(원문 표시 폴백).
export const PATCH_INLINE_MAX_CHARS = 1_000_000
// 계산 결과 캐시의 상한 — 결과 문자 수의 합.
export const COMPUTE_CACHE_MAX_CHARS = 4_000_000
// 워커가 연속으로 이만큼 실패하면 창이 닫힐 때까지 워커를 만들지 않는다.
export const COMPUTE_FAILURE_LIMIT = 3
