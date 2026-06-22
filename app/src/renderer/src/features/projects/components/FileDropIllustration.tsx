// 파일 드롭존의 장식용 일러스트 — 겹친 문서 3장 + 우상단 "+" 배지.
// Icon.tsx 는 single-path 규약이라 1회성 멀티-패스 일러스트는 여기 인라인으로 둔다.
// 색은 currentColor 를 상속(부모 text-ink3 톤). aria-hidden — 의미는 옆 카피가 전달.
export function FileDropIllustration(): React.JSX.Element {
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 뒤 페이지 (살짝 회전·반투명) */}
      <g opacity={0.4} transform="rotate(-9 22 22)">
        <path d="M13 8h11l7 7v18a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      </g>
      {/* 앞 페이지 + 접힌 모서리 + 본문 라인 */}
      <path d="M15 6h12l7 7v21a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M27 6v7h7" />
      <path d="M18 21h11M18 26h11M18 31h7" opacity={0.7} />
      {/* 우상단 "+" 배지 */}
      <circle cx={34} cy={10} r={6} fill="var(--color-panel)" />
      <path d="M34 7.5v5M31.5 10h5" />
    </svg>
  )
}
