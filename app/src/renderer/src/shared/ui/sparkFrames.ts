// StatusLine 스피너의 프레임 인코딩(0208) — 원본 스프라이트 스트립을 **펼치지 않고** 같은
// 시퀀스를 내는 값싼 표현. 원본(`docs/handoff/0208-.../spinner-reference.svg`)은 241 프레임을
// 세로로 쌓아 translateY 로 밀었지만(인스턴스당 ~1767 SVG 노드) 매 프레임 보이는 마크는
// 하나뿐이다. 그래서 마크 7개만 그리고 CSS 트랙으로 켜고 끈다(~19 노드).
//
// 시간축은 원본 그대로 **241 슬롯**이다. frame 240 은 frame 0 과 같은 그림이지만 별도 슬롯이라
// (약 29.8755ms) 240 으로 정규화하면 타이밍이 달라진다(D-016). 241 mod 24 = 1 이므로 scale 을
// 24 프레임 주기로 반복시킬 수 없다 — CSS 는 한 바퀴(7200ms) 전체를 241 stop 으로 갖는다.
//
// 여기 상수와 `styles/app.css` 의 `spark-*` 키프레임은 **손으로 동기화하는 두 사본**이다.
// 둘 다 원본에서 파생됐다는 것은 `sparkFrames.test.ts`·`sparkCss.test.ts` 가 원본 SVG 를
// 직접 파싱해 241/241 로 대조한다 — 기대값을 테스트에 다시 전사하지 않는다.

export type SparkShape = 'spoke' | 'dot' | '✢' | '✳︎' | '✶' | '✻' | '✽'

/** 원본의 시간 슬롯 수. 마지막 슬롯은 frame 0 과 같은 그림이지만 시간을 차지한다. */
export const SPARK_TOTAL_FRAMES = 241
/** 원본 `animation: spark-frames 7200ms steps(1, end) infinite` 의 한 바퀴. */
export const SPARK_PERIOD_MS = 7200
/** 슬롯 하나의 길이 — 약 29.8755ms. 30ms 로 반올림하지 않는다(240 정규화 금지). */
export const SPARK_FRAME_MS = SPARK_PERIOD_MS / SPARK_TOTAL_FRAMES

/**
 * 슬롯별 마크 배율 — 원본 프레임 그룹의 `scale(...)` 를 순서대로 옮긴 241 항이다.
 * 규칙성이 보여도 생성식으로 재유도하지 않는다: off-by-one 이 애니메이션을 조용히 바꾸고
 * 그때 원본과 대조할 근거가 사라진다.
 */
export const SPARK_FRAME_SCALES: readonly number[] = [
  1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73,
  0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34,
  1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84,
  0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01,
  1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39,
  0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53,
  0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07,
  1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63,
  0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36,
  0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93,
  0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93,
  1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34,
  0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74, 0.63,
  0.53, 0.45, 0.39, 0.36, 0.34, 1, 0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13,
  1.07, 1.02, 1
]

/** 마크별로 보이는 슬롯 구간 `[시작, 끝]`(양끝 포함) — 원본 프레임 시퀀스에서 얻는다. */
export const SPARK_SHAPE_WINDOWS: Readonly<
  Record<SparkShape, readonly (readonly [number, number])[]>
> = {
  spoke: [
    [0, 9],
    [35, 57],
    [83, 105],
    [131, 153],
    [179, 201],
    [227, 240]
  ],
  dot: [
    [10, 10],
    [34, 34],
    [58, 58],
    [82, 82],
    [106, 106],
    [130, 130],
    [154, 154],
    [178, 178],
    [202, 202],
    [226, 226]
  ],
  '✢': [[11, 33]],
  '✳︎': [[59, 81]],
  '✶': [[107, 129]],
  '✻': [[155, 177]],
  '✽': [[203, 225]]
}

/** 마크를 그리는 순서 — 화면에서는 매 슬롯 하나만 보인다. */
export const SPARK_SHAPES: readonly SparkShape[] = ['spoke', 'dot', '✢', '✳︎', '✶', '✻', '✽']

/**
 * 마크 → `styles/app.css` 의 visibility 트랙 클래스. 글리프는 문자 자체를 클래스에 쓸 수
 * 없으므로 `g1`~`g5` 로 번호를 매긴다(번호는 등장 순서). scale 트랙은 마크 공용이라 별도.
 *
 * 값은 **반드시 따옴표 리터럴**이다 — Tailwind `@utility` 는 소스에 리터럴이 있을 때만
 * 방출되고, 조립하면 CSS 가 통째로 사라지면서 스피너만 조용히 멈춘다(`sparkCss.test.ts`).
 */
export const SPARK_SCALE_CLASS = 'animate-spark-scale'
export const SPARK_TRACK_CLASS: Readonly<Record<SparkShape, string>> = {
  spoke: 'animate-spark-spoke',
  dot: 'animate-spark-dot',
  '✢': 'animate-spark-g1',
  '✳︎': 'animate-spark-g2',
  '✶': 'animate-spark-g3',
  '✻': 'animate-spark-g4',
  '✽': 'animate-spark-g5'
}

/**
 * 슬롯 n 의 키 타임(%) — 원본 `@keyframes` 가 쓴 것과 같은 4자리 직렬화다.
 * CSS stop 경계가 이 문자열과 어긋나면 슬롯 길이가 원본과 달라진다.
 */
export function frameKeyTimePct(frame: number): string {
  return ((frame / SPARK_TOTAL_FRAMES) * 100).toFixed(4)
}

export function scaleAtFrame(frame: number): number {
  const scale = SPARK_FRAME_SCALES[frame]
  if (scale === undefined) throw new Error(`spark: 슬롯 ${frame} 은(는) 범위 밖이다`)
  return scale
}

export function shapeAtFrame(frame: number): SparkShape {
  for (const shape of SPARK_SHAPES) {
    for (const [from, to] of SPARK_SHAPE_WINDOWS[shape]) {
      if (frame >= from && frame <= to) return shape
    }
  }
  throw new Error(`spark: 슬롯 ${frame} 을(를) 덮는 구간이 없다`)
}
