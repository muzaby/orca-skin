// 0208 — 첨부 원본 SVG(`docs/handoff/0208-.../spinner-reference.svg`)를 읽는 **테스트 전용**
// 파서. 프로덕션은 이 파일도 원본도 import 하지 않는다(D-017 — 원본은 54,552 bytes·~1,767
// 노드라 번들에 들어가면 성능 계약이 깨진다). `sparkCss.test.ts` 가 그 0건을 센다.
//
// 이 파서의 존재 이유: r1 은 기대값 240행을 테스트 파일에 **손으로 전사**했다. 그러면 oracle
// 이 자기 전사본을 검증하는 허수아비가 되고 원본이 바뀌어도 테스트가 반응하지 않는다.
// 여기서는 원본 XML 에서 직접 읽는다 — 특히 **key time 은 계산하지 않고 파일의 `%` 문자열을
// 그대로 가져온다**(계산하면 런타임 쪽 공식과 같아져 대조가 순환이 된다).
//
// 구조가 예상과 다르면 **던진다**. 조용히 빈 값을 돌려주면 변조 fixture 가 통과한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { SparkShape } from './sparkFrames'

/** plan.md 와 같은 디렉터리에 사는 원본. 이 경로 문자열은 테스트에만 존재한다. */
const REFERENCE_URL = new URL(
  '../../../../../../docs/handoff/0208-spinner-instructions-usage-tooltip/spinner-reference.svg',
  import.meta.url
)

export interface SpinnerReferenceFrame {
  /** 이 슬롯에 보이는 마크. */
  shape: SparkShape
  /** 이 슬롯의 마크 배율 — 프레임 그룹의 `scale(...)`, 없으면 1. */
  scale: number
}

export interface SpinnerReference {
  /** 프레임 그룹 순서대로 — 원본의 시간 슬롯 전수. */
  frames: readonly SpinnerReferenceFrame[]
  /** `@keyframes spark-frames` 의 stop 문자열 전수(`'0.4149'` 꼴). 계산값이 아니다. */
  keyTimesPct: readonly string[]
  /** 바깥 `<svg style="color:…">` 의 고정색. */
  color: string
  /** 애니메이션 한 바퀴(ms). */
  periodMs: number
  /** 계단 타이밍 함수 — 원본은 `steps(1, end)`. */
  timingFunction: string
  width: number
  height: number
  viewBox: string
  /** `<defs>` 의 `#ten-spoked` 기하. */
  spoke: {
    strokeWidth: string
    strokeLinecap: string
    transform: string
    /** 살 10개의 회전각(0 은 transform 없음 → 0 으로 읽는다). */
    angles: readonly number[]
    x1: string
    y1: string
    x2: string
    y2: string
  }
  dot: { cx: string; cy: string; r: string }
  text: {
    x: string
    y: string
    fontSize: string
    fontFamily: string
    textAnchor: string
    dominantBaseline: string
  }
  /** 글리프 5종 — 원본 등장 순서. */
  glyphs: readonly string[]
  /** 원본이 감속 모션에서 애니메이션을 끄는가. */
  reducedMotionStops: boolean
}

function required(value: string | null | undefined, what: string): string {
  if (value == null || value === '') throw new Error(`spinner-reference: ${what} 를 찾지 못했다`)
  return value
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]
}

/** 스타일 블록의 선언 값 — `.spark-text { font-size: 58px }` 같은 한 줄. */
function decl(css: string, selector: string, property: string): string {
  const block = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
  const value = new RegExp(`\\b${property}\\s*:\\s*([^;]+);`).exec(required(block, selector))?.[1]
  return required(value, `${selector} 의 ${property}`).trim()
}

export function parseSpinnerReference(svg: string): SpinnerReference {
  const rootTag = required(/<svg\b[\s\S]*?>/.exec(svg)?.[0], '루트 <svg>')
  const style = required(attr(rootTag, 'style'), '루트 svg 의 style')
  const color = required(/color:\s*(#[0-9a-f]{6})/i.exec(style)?.[1], '고정색')

  // --- 프레임 그룹 전수 ---
  const stripAt = svg.indexOf('<g class="spark-strip">')
  if (stripAt < 0) throw new Error('spinner-reference: spark-strip 그룹이 없다')
  const chunks = svg
    .slice(stripAt)
    .split(/<g transform="translate\(0 (\d+)\)">/)
    .slice(1)
  const frames: SpinnerReferenceFrame[] = []
  for (let i = 0; i < chunks.length; i += 2) {
    const offsetY = Number(chunks[i])
    const body = chunks[i + 1]
    if (offsetY !== frames.length * 100) {
      throw new Error(`spinner-reference: 프레임 ${frames.length} 의 translateY 가 ${offsetY} 다`)
    }
    const scale = Number(/scale\(([\d.]+)\)/.exec(body)?.[1] ?? 1)
    let shape: SparkShape
    if (body.includes('<use href="#ten-spoked"/>')) shape = 'spoke'
    else if (body.includes('<circle')) shape = 'dot'
    else {
      const glyph = /<text[^>]*>([^<]+)<\/text>/.exec(body)?.[1]
      shape = required(glyph, `프레임 ${frames.length} 의 마크`) as SparkShape
    }
    frames.push({ shape, scale })
  }
  if (frames.length === 0) throw new Error('spinner-reference: 프레임이 하나도 없다')

  // --- key time: 파일의 문자열을 그대로 (계산 금지) ---
  const keyframesBlock = required(
    /@keyframes spark-frames \{([\s\S]*?)\n {4}\}/.exec(svg)?.[1],
    '@keyframes spark-frames'
  )
  const keyTimesPct = [
    ...keyframesBlock.matchAll(/([\d.]+)% \{ transform: translateY\(-\d+px\); \}/g)
  ].map((m) => m[1])

  // --- 애니메이션 선언 ---
  const animation = decl(svg, 'spark-strip', 'animation')
  const periodMs = Number(required(/(\d+)ms/.exec(animation)?.[1], 'animation duration'))
  const timingFunction = required(/(steps\([^)]*\))/.exec(animation)?.[1], 'timing function')

  // --- 기하 ---
  const defs = required(/<g id="ten-spoked"[\s\S]*?<\/g>/.exec(svg)?.[0], '#ten-spoked')
  const spokeTag = required(/<g id="ten-spoked"[^>]*>/.exec(defs)?.[0], '#ten-spoked 여는 태그')
  const lines = [...defs.matchAll(/<line\b[^>]*\/>/g)].map((m) => m[0])
  if (lines.length === 0) throw new Error('spinner-reference: spoke <line> 이 없다')
  const angles = lines.map((l) => Number(/rotate\((\d+)/.exec(l)?.[1] ?? 0))
  const circleTag = required(/<circle\b[^>]*\/>/.exec(svg)?.[0], '<circle>')
  const textTag = required(/<text\b[^>]*>/.exec(svg)?.[0], '<text>')

  const glyphs: string[] = []
  for (const { shape } of frames) {
    if (shape !== 'spoke' && shape !== 'dot' && !glyphs.includes(shape)) glyphs.push(shape)
  }

  return {
    frames,
    keyTimesPct,
    color,
    periodMs,
    timingFunction,
    width: Number(required(attr(rootTag, 'width'), 'svg width')),
    height: Number(required(attr(rootTag, 'height'), 'svg height')),
    viewBox: required(attr(rootTag, 'viewBox'), 'viewBox'),
    spoke: {
      strokeWidth: required(attr(spokeTag, 'stroke-width'), 'stroke-width'),
      strokeLinecap: required(attr(spokeTag, 'stroke-linecap'), 'stroke-linecap'),
      transform: required(attr(spokeTag, 'transform'), 'spoke transform'),
      angles,
      x1: required(attr(lines[0], 'x1'), 'line x1'),
      y1: required(attr(lines[0], 'y1'), 'line y1'),
      x2: required(attr(lines[0], 'x2'), 'line x2'),
      y2: required(attr(lines[0], 'y2'), 'line y2')
    },
    dot: {
      cx: required(attr(circleTag, 'cx'), 'circle cx'),
      cy: required(attr(circleTag, 'cy'), 'circle cy'),
      r: required(attr(circleTag, 'r'), 'circle r')
    },
    text: {
      x: required(attr(textTag, 'x'), 'text x'),
      y: required(attr(textTag, 'y'), 'text y'),
      fontSize: decl(svg, 'spark-text', 'font-size'),
      fontFamily: decl(svg, 'spark-text', 'font-family'),
      textAnchor: decl(svg, 'spark-text', 'text-anchor'),
      dominantBaseline: decl(svg, 'spark-text', 'dominant-baseline')
    },
    glyphs,
    reducedMotionStops: /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/.test(svg)
  }
}

/** 커밋된 원본의 원문. 변조 fixture 는 이 문자열을 바꿔 파서에 다시 넣는다. */
export function readSpinnerReferenceText(): string {
  return readFileSync(fileURLToPath(REFERENCE_URL), 'utf8')
}
