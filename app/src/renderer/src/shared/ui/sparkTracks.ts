// StatusLine 스피너의 트랙 상수 — 원본(`docs/handoff/0216-.../spinner-reference.svg`)의
// `.sA`~`.sE` 다섯 마크를 `styles/app.css` 의 `spark-a`~`spark-e` 키프레임에 잇는다.
//
// 원본은 마크 5종을 인라인 `<style>` 로 돌리지만, 인스턴스마다 규칙 사본이 생기므로 여기서는
// 키프레임을 `app.css` 에 **전역 1회** 두고 컴포넌트는 클래스만 소비한다. 인스턴스당 애니메이션은
// 마크 5개로 고정이고, 인스턴스가 늘어도 CSS stop 수는 늘지 않는다.
//
// 여기 상수와 `styles/app.css` 의 키프레임은 **손으로 동기화하는 두 사본**이다. 둘 다 원본에서
// 파생됐다는 것은 `sparkCss.test.ts` 가 원본 SVG 를 직접 파싱해 대조한다 — 기대값을 테스트에
// 다시 전사하지 않는다.

export type SparkMark = 'a' | 'b' | 'c' | 'd' | 'e'

/** 원본의 마크 등장 순서 — `.sA`~`.sE`. */
export const SPARK_MARKS: readonly SparkMark[] = ['a', 'b', 'c', 'd', 'e']

/** 원본 `animation-duration: 4.80s` 의 한 바퀴. */
export const SPARK_PERIOD_MS = 4800

/**
 * 마크 → `styles/app.css` 의 트랙 클래스.
 *
 * 값은 **반드시 따옴표 리터럴**이다 — Tailwind `@utility` 는 소스에 리터럴이 있을 때만
 * 방출되고, 조립하면 CSS 가 통째로 사라지면서 스피너만 조용히 멈춘다(`sparkCss.test.ts`).
 */
export const SPARK_TRACK_CLASS: Readonly<Record<SparkMark, string>> = {
  a: 'animate-spark-a',
  b: 'animate-spark-b',
  c: 'animate-spark-c',
  d: 'animate-spark-d',
  e: 'animate-spark-e'
}

/** 감속 모션에서 홀로 남는 마크 — 원본의 `.sB { opacity: 1 }`. */
export const SPARK_REDUCED_MOTION_MARK: SparkMark = 'b'
