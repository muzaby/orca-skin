// 계산 워커와 UI 스레드 사이의 상한 (0324 D-008·D-012·D-014 · 0325 D-008~D-011·D-038). 수치의 근거
// (측정값)는 0324 plan §8·B8 과 0325 plan §8 — docs/handoff/0324-*/plan.md · docs/handoff/0325-*/plan.md.

// 이 글자 수 이하의 코드에만 구문 강조를 요청한다 — 강조 결과를 DOM 에 넣는 일은 UI 스레드에 남는다.
export const HIGHLIGHT_MAX_CHARS = 32_000
// 두 입력의 줄 수 합이 이 값 이하면 diff 줄 계산을 UI 스레드에서 한다. 넘으면 워커가 한다.
export const DIFF_INLINE_MAX_LINES = 400
// 두 입력의 문자 수 합 상한 — 줄 수보다 먼저 본다. 한 줄이 거대한 입력이 줄 상한을 통과하지 않게 한다.
export const DIFF_INLINE_MAX_CHARS = 64_000
// 이 글자 수를 넘는 unified patch 는 UI 스레드에서 파싱하지 않는다(원문 표시 폴백).
export const PATCH_INLINE_MAX_CHARS = 1_000_000
// 계산 결과 캐시의 상한 — 항목 비용(요청 키 길이 + 워커가 센 결과 크기)의 합.
export const COMPUTE_CACHE_MAX_CHARS = 4_000_000
// 캐시 항목 수 상한 — 항목마다의 고정 비용(Map 항목·래퍼)을 묶는다(0325 D-038, 사용자 거부 가능).
export const COMPUTE_CACHE_MAX_ENTRIES = 1_000
// 결과의 줄·행·토큰 객체 하나를 문자 수로 환산한 값 — 빈 줄 객체 72B ÷ 2B(0325 §8 X5 · B22).
export const COMPUTE_RESULT_ELEMENT_CHARS = 36
// 컴포저 초안이 이 글자 수를 넘으면 장식(chip 배경)을 만들지 않는다(0325 D-010).
export const COMPOSER_DECORATION_MAX_CHARS = 20_000
// 워커가 연속으로 이만큼 실패하면 창이 닫힐 때까지 워커를 만들지 않는다.
export const COMPUTE_FAILURE_LIMIT = 3
