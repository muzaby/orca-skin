// StatusLine 스피너의 프레임 인코딩(0208) — 원본 스프라이트 스트립을 **펼치지 않고** 같은
// 시퀀스를 내는 값싼 표현. 원본은 241 프레임을 세로로 쌓아 translateY 로 밀었지만(인스턴스당
// ~1767 SVG 노드) 실측상 매 프레임 보이는 마크는 하나뿐이고 scale 은 24 프레임마다 같은
// 시퀀스를 반복한다. 그래서 마크 7개만 그리고 CSS 트랙으로 켜고 끈다(~19 노드).
//
// 여기 상수와 `styles/app.css` 의 `spark-*` 키프레임은 **손으로 동기화**한다 — 어긋나면
// `sparkCss.test.ts` 가 원문 대조로 잡는다. 원본과의 프레임 단위 등가는 `sparkFrames.test.ts`
// 가 240/240 으로 증명한다(전사본이 그 파일에 산다).

export type SparkShape = 'spoke' | 'dot' | '✢' | '✳︎' | '✶' | '✻' | '✽'

/** 한 바퀴 = 240 프레임. 원본의 241번째는 frame 0 과 같은 루프 닫는 중복이라 뺀다. */
export const SPARK_TOTAL_FRAMES = 240
/** 원본: 7200ms / 241 stop. 240 프레임 주기로 보면 프레임당 정확히 30ms. */
export const SPARK_PERIOD_MS = 7200
export const SPARK_FRAME_MS = SPARK_PERIOD_MS / SPARK_TOTAL_FRAMES
/** scale 시퀀스의 반복 단위 — dot~dot 세그먼트 9개가 전부 동일하다는 실측에서 나온다. */
export const SPARK_SEGMENT_FRAMES = 24
export const SPARK_SEGMENT_MS = SPARK_FRAME_MS * SPARK_SEGMENT_FRAMES
/** frame 0 이 세그먼트의 몇 번째인가 — CSS 는 이만큼 음수 delay 로 위상을 맞춘다. */
export const SPARK_SEGMENT_PHASE = 13
export const SPARK_SEGMENT_DELAY_MS = -SPARK_SEGMENT_PHASE * SPARK_FRAME_MS

/** 세그먼트 하나의 scale — 마지막 항은 dot 자리(원본에서 dot 은 배율 없이 그려진다). */
export const SPARK_SEGMENT_SCALES: readonly number[] = [
  0.34, 0.39, 0.46, 0.54, 0.63, 0.73, 0.83, 0.93, 1.01, 1.08, 1.13, 1.07, 1.02, 1, 0.93, 0.84, 0.74,
  0.63, 0.53, 0.45, 0.39, 0.36, 0.34, 1
]

/** 마크별로 보이는 프레임 구간 `[시작, 끝]`(양끝 포함). */
export const SPARK_SHAPE_WINDOWS: Readonly<
  Record<SparkShape, readonly (readonly [number, number])[]>
> = {
  spoke: [
    [0, 9],
    [35, 57],
    [83, 105],
    [131, 153],
    [179, 201],
    [227, 239]
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

/** 마크를 그리는 순서 — 화면에서는 매 프레임 하나만 보인다. */
export const SPARK_SHAPES: readonly SparkShape[] = ['spoke', 'dot', '✢', '✳︎', '✶', '✻', '✽']

/**
 * 마크 → `styles/app.css` 의 visibility 트랙 클래스. 글리프는 문자 자체를 클래스에 쓸 수
 * 없으므로 `g1`~`g5` 로 번호를 매긴다(번호는 등장 순서). scale 트랙은 마크 공용이라 별도.
 */
export const SPARK_PULSE_CLASS = 'animate-spark-pulse'
export const SPARK_TRACK_CLASS: Readonly<Record<SparkShape, string>> = {
  spoke: 'animate-spark-spoke',
  dot: 'animate-spark-dot',
  '✢': 'animate-spark-g1',
  '✳︎': 'animate-spark-g2',
  '✶': 'animate-spark-g3',
  '✻': 'animate-spark-g4',
  '✽': 'animate-spark-g5'
}

export function scaleAtFrame(frame: number): number {
  const i = (frame + SPARK_SEGMENT_PHASE) % SPARK_SEGMENT_FRAMES
  return SPARK_SEGMENT_SCALES[i]
}

export function shapeAtFrame(frame: number): SparkShape {
  for (const shape of SPARK_SHAPES) {
    for (const [from, to] of SPARK_SHAPE_WINDOWS[shape]) {
      if (frame >= from && frame <= to) return shape
    }
  }
  throw new Error(`spark: frame ${frame} 을(를) 덮는 구간이 없다`)
}
