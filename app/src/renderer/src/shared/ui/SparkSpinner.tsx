// 어시스턴트 턴 진행 스피너(0208) — 마크 7종을 **한 번만** 그리고 `styles/app.css` 의
// `spark-*` 트랙이 프레임마다 하나씩 켠다. 원본 아티팩트는 241 프레임을 세로로 쌓은
// 스프라이트 스트립이라 인스턴스당 ~1767 노드였다(동시 3곳 = ~5300). 여기서는 ~19 노드다.
// 프레임 시퀀스가 원본과 같다는 것은 `sparkFrames.test.ts` 가 240/240 으로 증명한다.
//
// Icon.tsx 는 single-path 규약이라 stroke·멀티마크인 이 스피너는 여기 인라인으로 둔다
// (OrcaLogo 와 같은 자리). 색은 지정하지 않는다 — 부모의 text-* 를
// currentColor 로 상속하므로 두 테마가 자동으로 맞는다(raw hex 금지, renderer/AGENTS.md).

import { SPARK_PULSE_CLASS, SPARK_TRACK_CLASS } from './sparkFrames'

/** 원본 `#ten-spoked` 의 살 각도. 0°부터 36° 간격 10개. */
const SPOKE_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]

/** 원본에서 글리프는 등장 순서대로 이 다섯이다. */
const GLYPHS = ['✢', '✳︎', '✶', '✻', '✽'] as const

export function SparkSpinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      {/* scale 트랙 — 세그먼트 24 프레임이 전부 같아 마크 공용으로 하나면 된다. */}
      <g className={SPARK_PULSE_CLASS}>
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
