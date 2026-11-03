// "opencode" 레트로 픽셀 워드마크 — OpenCode 글꼴(opencode.ai/font, resources/opencode-wordmark.otf)로
// 텍스트를 그린다. 글꼴·음영 규칙은 `styles/app.css` 의 `opencode-wordmark` 유틸리티가 갖는다.
// 음영을 글자마다 정확히 깔기 위해 글자 단위 span 으로 나눈다. 크기는 font-size 로 정하고,
// 인라인 텍스트라 주변 글자와 기준선이 자동으로 맞는다.
// MIT; copyright (c) 2025 opencode. See resources/OPENCODE-LICENSE.txt.
const LETTERS = ['o', 'p', 'e', 'n', 'c', 'o', 'd', 'e'] as const

export function OpenCodeWordmark({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <span role="img" aria-label="opencode" className={`opencode-wordmark ${className}`}>
      {LETTERS.map((letter, i) => (
        <span key={i} aria-hidden>
          {letter}
        </span>
      ))}
    </span>
  )
}
