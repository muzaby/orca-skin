// "opencode" 레트로 픽셀 워드마크 — opencode.ai/font 의 픽셀 글꼴을 39×7 격자로 옮긴 SVG.
// 글꼴 파일을 번들에 싣지 않고 OpenCodeLogo 와 같은 방식(currentColor + 0.35 음영)으로 그린다.
// MIT; copyright (c) 2025 opencode. See resources/OPENCODE-LICENSE.txt.
export function OpenCodeWordmark({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 39 7"
      fill="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label="opencode"
      className={className}
    >
      <path
        d="M1 3h2v1H1ZM6 3h2v1H6ZM16 3h2v1H16ZM21 3h3v1H21ZM26 3h2v1H26ZM31 3h2v1H31ZM1 4h2v1H1ZM6 4h2v1H6ZM11 4h3v1H11ZM16 4h2v1H16ZM21 4h3v1H21ZM26 4h2v1H26ZM31 4h2v1H31ZM36 4h3v1H36ZM16 5h2v1H16Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M33 0h1v1H33ZM0 1h4v1H0ZM5 1h4v1H5ZM10 1h4v1H10ZM15 1h3v1H15ZM20 1h4v1H20ZM25 1h4v1H25ZM30 1h4v1H30ZM35 1h4v1H35ZM0 2h1v1H0ZM3 2h1v1H3ZM5 2h1v1H5ZM8 2h1v1H8ZM10 2h1v1H10ZM13 2h1v1H13ZM15 2h1v1H15ZM18 2h1v1H18ZM20 2h1v1H20ZM25 2h1v1H25ZM28 2h1v1H28ZM30 2h1v1H30ZM33 2h1v1H33ZM35 2h1v1H35ZM38 2h1v1H38ZM0 3h1v1H0ZM3 3h1v1H3ZM5 3h1v1H5ZM8 3h1v1H8ZM10 3h4v1H10ZM15 3h1v1H15ZM18 3h1v1H18ZM20 3h1v1H20ZM25 3h1v1H25ZM28 3h1v1H28ZM30 3h1v1H30ZM33 3h1v1H33ZM35 3h4v1H35ZM0 4h1v1H0ZM3 4h1v1H3ZM5 4h1v1H5ZM8 4h1v1H8ZM10 4h1v1H10ZM15 4h1v1H15ZM18 4h1v1H18ZM20 4h1v1H20ZM25 4h1v1H25ZM28 4h1v1H28ZM30 4h1v1H30ZM33 4h1v1H33ZM35 4h1v1H35ZM0 5h4v1H0ZM5 5h4v1H5ZM10 5h4v1H10ZM15 5h1v1H15ZM18 5h1v1H18ZM20 5h4v1H20ZM25 5h4v1H25ZM30 5h4v1H30ZM35 5h4v1H35ZM5 6h1v1H5Z"
        fill="currentColor"
      />
    </svg>
  )
}
