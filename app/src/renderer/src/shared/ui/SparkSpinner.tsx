// 어시스턴트 턴 진행 스피너 — 마크 5종을 **한 번만** 그리고 `styles/app.css` 의 `spark-*`
// 트랙이 하나씩 켠다. 원본 아티팩트(`docs/handoff/0216-.../spinner-reference.svg`)는 같은 마크를
// 인라인 `<style>` 로 돌리는데, 그러면 인스턴스마다 규칙 사본이 생긴다. 여기서는 키프레임이
// `app.css` 에 전역 1회 살고 인스턴스당 애니메이션은 마크 5개로 고정이다.
// 프레임 진행은 브라우저가 갖는다 — React 상태·타이머가 없으므로 스트리밍 델타 경로가
// 스피너 때문에 다시 그려지지 않는다.
//
// 기하(viewBox · 좌표 · stroke-width · r · path)는 원본 값을 문자열 그대로 옮긴 것이고,
// `statusLine.render.test.ts` 가 렌더 출력과 원본을 태그 단위로 대조한다.
// **크기만 원본을 따르지 않는다** — 원본은 100×100 이지만 여기서는 14×14 다. 사용자·어시스턴트
// 버블 본문(`text-[14px]`)과 같은 치수라, 옆의 12px 상태문구보다 크게 읽힌다.
//
// Icon.tsx 는 single-path 규약이라 stroke·멀티마크인 이 스피너는 여기 인라인으로 둔다
// (OrcaLogo 와 같은 자리). 색은 지정하지 않는다 — 소비자가 주는 `text-spinner` 를
// currentColor 로 상속한다(raw hex 금지, renderer/AGENTS.md). 원본은 두 테마 구분 없이
// 항상 #C15F3C 이므로 그 토큰도 테마 스코프에 재정의되지 않는다.

import { SPARK_TRACK_CLASS } from './sparkTracks'

/** 원본 좌표는 문자열 그대로 옮긴다 — 숫자로 적으면 `50.0` 이 `50` 으로 직렬화돼 대조가 깨진다. */
const CENTER = { x1: '50.0', y1: '50.0' } as const

/** `.sA` — 6갈래 별. */
const MARK_A_ENDS: readonly (readonly [string, string])[] = [
  ['74.96', '64.41'],
  ['50.00', '78.82'],
  ['25.04', '64.41'],
  ['25.04', '35.59'],
  ['50.00', '21.18'],
  ['74.96', '35.59']
]

/** `.sB` — 가운데 원 + 10갈래 살. 감속 모션에서 홀로 남는 마크다. */
const MARK_B_ENDS: readonly (readonly [string, string])[] = [
  ['86.44', '61.84'],
  ['72.52', '80.99'],
  ['50.00', '88.31'],
  ['27.48', '80.99'],
  ['13.56', '61.84'],
  ['13.56', '38.16'],
  ['27.48', '19.01'],
  ['50.00', '11.69'],
  ['72.52', '19.01'],
  ['86.44', '38.16']
]

/** `.sC`·`.sE` 의 꽃잎 회전각 — 두 마크가 같은 6각을 쓴다. */
const PETAL_ROTATIONS = ['120.0', '180.0', '240.0', '300.0', '360.0', '420.0'] as const

const MARK_C_PETAL = 'M 0,-4.89 L -7.22,-32.17 A 7.47,7.47 0 1 1 7.22,-32.17 Z'
const MARK_E_PETAL = 'M 0,-15.33 L -6.89,-31.15 A 7.51,7.51 0 1 1 6.89,-31.15 Z'

/** `.sD` — 4갈래 별 하나. */
const MARK_D_PATH =
  'M 81.66,68.28 Q 67.34,63.59 56.88,61.91 Q 53.09,71.81 50.00,86.56 Q 46.91,71.81 43.12,61.91 ' +
  'Q 32.66,63.59 18.34,68.28 Q 29.56,58.22 36.24,50.00 Q 29.56,41.77 18.34,31.72 ' +
  'Q 32.66,36.41 43.12,38.09 Q 46.91,28.19 50.00,13.44 Q 53.09,28.19 56.88,38.09 ' +
  'Q 67.34,36.41 81.66,31.72 Q 70.44,41.77 63.76,50.00 Q 70.44,58.22 81.66,68.28 Z'

function petal(mark: 'c' | 'e', d: string): React.JSX.Element[] {
  return PETAL_ROTATIONS.map((deg) => (
    <path key={`${mark}${deg}`} d={d} transform={`translate(50.0,50.0) rotate(${deg})`} />
  ))
}

export function SparkSpinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 100 100"
      fill="currentColor"
      stroke="currentColor"
      aria-hidden="true"
      className={className}
    >
      <g className={SPARK_TRACK_CLASS.a}>
        {MARK_A_ENDS.map(([x2, y2]) => (
          <line
            key={`a${x2},${y2}`}
            x1={CENTER.x1}
            y1={CENTER.y1}
            x2={x2}
            y2={y2}
            strokeWidth="7.78"
            strokeLinecap="round"
          />
        ))}
      </g>
      <g className={SPARK_TRACK_CLASS.b}>
        <circle cx="50.0" cy="50.0" r="15.91" />
        {MARK_B_ENDS.map(([x2, y2]) => (
          <line
            key={`b${x2},${y2}`}
            x1={CENTER.x1}
            y1={CENTER.y1}
            x2={x2}
            y2={y2}
            strokeWidth="7.56"
            strokeLinecap="round"
          />
        ))}
      </g>
      <g className={SPARK_TRACK_CLASS.c}>
        <circle cx="50.0" cy="50.0" r="3.33" />
        {petal('c', MARK_C_PETAL)}
      </g>
      <g className={SPARK_TRACK_CLASS.d}>
        <path d={MARK_D_PATH} />
      </g>
      <g className={SPARK_TRACK_CLASS.e}>
        <circle cx="50.0" cy="50.0" r="8.33" />
        {petal('e', MARK_E_PETAL)}
      </g>
    </svg>
  )
}
