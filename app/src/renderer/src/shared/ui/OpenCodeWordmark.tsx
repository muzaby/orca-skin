// "opencode" 레트로 픽셀 워드마크 — OpenCode 글꼴(opencode.ai/font)의 글리프 윤곽을 그대로 옮긴 벡터.
// 좌표는 글꼴 격자(60 unit = 1칸) 기준이라 정수로 떨어지고, 어떤 배율에서도 윤곽이 정확하다.
// 글꼴 파일을 번들에 싣지 않고 OpenCodeLogo 와 같은 방식(currentColor + 0.35 음영)으로 그린다 —
// 음영은 각 글자 아래 2/3(글꼴 y 0~360) 에서 획이 덮지 않은 자리만 보인다.
// MIT; copyright (c) 2025 opencode. See resources/OPENCODE-LICENSE.txt.
export function OpenCodeWordmark({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 78 14" fill="none" role="img" aria-label="opencode" className={className}>
      <path
        d="M0 6h8v6h-8ZM10 6h8v6h-8ZM20 6h8v6h-8ZM30 6h8v6h-8ZM40 6h8v6h-8ZM50 6h8v6h-8ZM60 6h8v6h-8ZM70 6h8v6h-8Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M6 4H2V10H6ZM8 12H0V2H8ZM12 10H16V4H12ZM18 12H12V14H10V2H18ZM28 8H22V10H28V12H20V2H28ZM22 6H26V4H22ZM36 4H32V12H30V2H36ZM38 12H36V4H38ZM48 4H42V10H48V12H40V2H48ZM56 4H52V10H56ZM58 12H50V2H58ZM66 4H62V10H66ZM68 12H60V2H66V0H68ZM78 8H72V10H78V12H70V2H78ZM72 6H76V4H72Z"
        fill="currentColor"
      />
    </svg>
  )
}
