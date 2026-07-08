// 동작하지 않는 장식/mock UI 공통 빗금 배경. data-state="mock" 과 함께 사용한다.
export const MOCK_HATCH_BG =
  'repeating-linear-gradient(135deg, rgba(120, 92, 70, 0.10) 0 6px, transparent 6px 12px)'

// "준비 중"(비활성) placeholder 영역의 테두리 톤 빗금 — 시맨틱 border 토큰 기반, 신규 CSS
// 없이 Tailwind arbitrary background-image 유틸. 자동화 nav·파일 첨부 카드 등이 공유한다.
export const DISABLED_HATCH_CLASS =
  '[background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)]'
