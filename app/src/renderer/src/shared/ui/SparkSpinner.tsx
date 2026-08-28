// 어시스턴트 턴 진행 스피너(0208) — 마크 7종을 **한 번만** 그리고 `styles/app.css` 의
// `spark-*` 트랙이 슬롯마다 하나씩 켠다. 원본 아티팩트
// (`docs/handoff/0208-.../spinner-reference.svg`)는 241 프레임을 세로로 쌓은 스프라이트
// 스트립이라 인스턴스당 ~1767 노드였다(동시 3곳 = ~5300). 여기서는 ~19 노드다.
// 원본과 슬롯 단위로 같다는 것은 `sparkFrames.test.ts`·`sparkCss.test.ts` 가 원본 SVG 를
// 직접 파싱해 241/241 로 증명한다.
//
// 기하(18x18 · viewBox · stroke-width · scale · r · font-size · 글리프 5종)는 원본 값을 그대로
// 옮긴 것이고, `statusLine.render.test.ts` 가 렌더 출력과 원본을 대조한다.
// 원본의 `overflow:hidden` 은 바깥 <svg> 의 UA 기본값이라 다시 적지 않는다.
//
// Icon.tsx 는 single-path 규약이라 stroke·멀티마크인 이 스피너는 여기 인라인으로 둔다
// (OrcaLogo 와 같은 자리). 색은 지정하지 않는다 — 소비자가 주는 `text-spinner` 를
// currentColor 로 상속한다(raw hex 금지, renderer/AGENTS.md). 원본은 두 테마 구분 없이
// 항상 #d97757 이므로 그 토큰도 테마 스코프에 재정의되지 않는다(D-016).

import { SPARK_SCALE_CLASS, SPARK_TRACK_CLASS } from './sparkFrames'

/** 원본 `#ten-spoked` 의 살 각도. 0°부터 36° 간격 10개. */
const SPOKE_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]

/** 원본에서 글리프는 등장 순서대로 이 다섯이다. */
const GLYPHS = ['✢', '✳︎', '✶', '✻', '✽'] as const

export function SparkSpinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      {/* scale 트랙 — 마크 공용이라 하나면 된다. 한 바퀴 241 슬롯 전체를 담는다. */}
      <g className={SPARK_SCALE_CLASS}>
        {/* 원본 `#ten-spoked` 의 0.74 는 프레임 배율과 별개인 마크 고유 크기라 유지한다. */}
        <g
          className={SPARK_TRACK_CLASS.spoke}
          fill="none"
          stroke="currentColor"
          strokeWidth={6.2}
          strokeLinecap="round"
          transform="translate(50 50) scale(0.74) translate(-50 -50)"
        >
          {SPOKE_ANGLES.map((deg) => (
            <line
              key={deg}
              x1={50}
              y1={50}
              x2={50}
              y2={23.5}
              transform={deg === 0 ? undefined : `rotate(${deg} 50 50)`}
            />
          ))}
        </g>
        <circle className={SPARK_TRACK_CLASS.dot} cx={50} cy={50} r={6.8} fill="currentColor" />
        {GLYPHS.map((glyph) => (
          <text
            key={glyph}
            className={SPARK_TRACK_CLASS[glyph]}
            x={50}
            y={54}
            fill="currentColor"
            fontFamily='"Segoe UI Symbol", "Apple Symbols", sans-serif'
            fontSize={58}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {glyph}
          </text>
        ))}
      </g>
    </svg>
  )
}
