// 툴팁 표면 SSOT(0257 D-004·D-007) — 검은 배경(#0b0b0b)·흰 글자, 라이트·다크 동일.
// `Popover role="tooltip"`(TooltipHost·작업 진행 목록)과 사용량 차트 툴팁이 같은 클래스를 쓴다.
// 줄바꿈은 지키고(pre-line) 긴 문구는 28rem 에서 감는다.
export const TOOLTIP_SURFACE =
  'pointer-events-none max-w-[min(28rem,calc(100vw-1rem))] whitespace-pre-line break-words rounded-r3 bg-tooltip px-2.5 py-1.5 text-caption text-tooltip-ink shadow-sm'

// 툴팁 안 보조 줄(날짜·비용 등).
export const TOOLTIP_MUTED_TEXT = 'text-tooltip-ink-muted'
