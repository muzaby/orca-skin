// 첨부 원본 SVG(`docs/handoff/0216-.../spinner-reference.svg`)를 읽는 **테스트 전용** 파서.
// 프로덕션은 이 파일도 원본도 import 하지 않는다 — 원본은 c2pa manifest 를 포함한 14,401 bytes
// 라 번들에 들어가면 성능 계약이 깨진다. `sparkCss.test.ts` 가 그 0건을 센다.
//
// 이 파서의 존재 이유: 기대값을 테스트 파일에 손으로 전사하면 oracle 이 자기 전사본을 검증하는
// 허수아비가 되고, 원본이 바뀌어도 테스트가 반응하지 않는다. 여기서는 원본 XML 에서 직접
// 읽는다 — 특히 **key time 은 계산하지 않고 파일의 `%` 문자열을 그대로 가져온다**.
//
// 구조가 예상과 다르면 **던진다**. 조용히 빈 값을 돌려주면 변조 fixture 가 통과한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { SparkMark } from './sparkTracks'

/** 원본이 사는 곳. 이 경로 문자열은 테스트에만 존재한다. */
const REFERENCE_URL = new URL(
  '../../../../../../docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg',
  import.meta.url
)

/** 마크 그룹의 자식 하나 — 태그 이름과 속성 맵. 속성 순서에 좌우되지 않게 맵으로 읽는다. */
export interface SpinnerReferenceNode {
  tag: 'line' | 'circle' | 'path'
  attrs: Readonly<Record<string, string>>
}

/** `@keyframes kA` 한 stop — `%` 문자열은 파일 원문 그대로다. */
export interface SpinnerReferenceStop {
  at: string
  transform: string
  opacity: string
}

export interface SpinnerReferenceMark {
  /** `.sA` → `'a'`. */
  id: SparkMark
  nodes: readonly SpinnerReferenceNode[]
  stops: readonly SpinnerReferenceStop[]
}

export interface SpinnerReference {
  /** 루트 `<svg fill=… stroke=…>` 의 고정색. */
  color: string
  width: number
  height: number
  viewBox: string
  /** `.s` 의 `animation-duration` 을 ms 로 환산한 값. */
  periodMs: number
  /** `.s` 의 `animation-timing-function` — 공백·선행 0 을 정규화한 문자열. */
  timingFunction: string
  transformBox: string
  transformOrigin: string
  /** `.s` 의 기본 불투명도 — 마크는 꺼진 채로 시작한다. */
  baseOpacity: string
  /** 원본 등장 순서대로 마크 5종. */
  marks: readonly SpinnerReferenceMark[]
  /** 감속 모션에서 홀로 남는 마크. */
  reducedMotionMark: SparkMark
  /** 원본이 감속 모션에서 애니메이션을 끄는가. */
  reducedMotionStops: boolean
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value == null || value === '') throw new Error(`spinner-reference: ${what} 를 찾지 못했다`)
  return value
}

/** `cubic-bezier(.35,0,.25,1)` 과 `cubic-bezier(0.35, 0, 0.25, 1)` 을 같은 문자열로 만든다. */
export function normalizeTimingFunction(value: string): string {
  return value.replace(/\s+/g, '').replace(/(^|[(,])\./g, '$10.')
}

/** 스타일 블록의 선언 값 — `.s { … }` 같은 규칙 하나에서 한 속성을 읽는다. */
function decl(rule: string, property: string, what: string): string {
  return required(
    new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`).exec(rule)?.[1],
    what
  ).trim()
}

/** 태그 원문 → 속성 맵. */
function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

export function parseSpinnerReference(svg: string): SpinnerReference {
  // c2pa manifest 는 base64 덩어리라 아래 정규식들이 그 안에서 오탐할 수 있다 — 먼저 잘라낸다.
  const body = svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')

  const rootTag = required(/<svg\b[\s\S]*?>/.exec(body)?.[0], '루트 <svg>')
  const root = attrsOf(rootTag)
  const color = required(root.fill, '루트 svg 의 fill')
  if (root.stroke !== color) {
    throw new Error(`spinner-reference: fill(${color}) 과 stroke(${root.stroke}) 가 다르다`)
  }

  const style = required(/<style>([\s\S]*?)<\/style>/.exec(body)?.[1], '<style> 블록')

  // --- `.s` 공통 선언 ---
  const baseRule = required(/\.s\s*\{([^}]*)\}/.exec(style)?.[1], '.s 규칙')
  const duration = decl(baseRule, 'animation-duration', '.s 의 animation-duration')
  const seconds = Number(required(/^([\d.]+)s$/.exec(duration)?.[1], `duration ${duration}`))

  // --- 감속 모션 ---
  const reduced = required(
    /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {4}\}/.exec(style)?.[1],
    'prefers-reduced-motion 블록'
  )
  const reducedMark = required(
    /\.s([A-E])\s*\{\s*opacity:\s*1\s*\}/.exec(reduced)?.[1],
    '감속 모션에서 남는 마크'
  ).toLowerCase() as SparkMark

  // --- 마크 그룹 전수 (문서 순서) ---
  const marks: SpinnerReferenceMark[] = []
  for (const group of body.matchAll(/<g class="s s([A-E])">([\s\S]*?)<\/g>/g)) {
    const id = group[1].toLowerCase() as SparkMark
    const nodes = [...group[2].matchAll(/<(line|circle|path)\b([^>]*?)\/>/g)].map((m) => ({
      tag: m[1] as SpinnerReferenceNode['tag'],
      attrs: attrsOf(m[0])
    }))
    if (nodes.length === 0) throw new Error(`spinner-reference: 마크 ${id} 에 자식이 없다`)

    // `.sA{animation-name:kA}` — 마크와 키프레임의 연결도 파일에서 읽는다.
    const keyframeName = required(
      new RegExp(`\\.s${group[1]}\\s*\\{\\s*animation-name\\s*:\\s*(\\w+)\\s*\\}`).exec(style)?.[1],
      `마크 ${id} 의 animation-name`
    )
    const block = required(
      new RegExp(`@keyframes ${keyframeName} \\{([\\s\\S]*?)\\n {4}\\}`).exec(style)?.[1],
      `@keyframes ${keyframeName}`
    )
    const stops = [
      ...block.matchAll(/([\d.]+)% \{ transform: (scale\([\d.]+\)); opacity: ([\d.]+); \}/g)
    ].map((m) => ({ at: m[1], transform: m[2], opacity: m[3] }))
    if (stops.length === 0) throw new Error(`spinner-reference: ${keyframeName} 의 stop 이 없다`)

    marks.push({ id, nodes, stops })
  }
  if (marks.length === 0) throw new Error('spinner-reference: 마크 그룹이 하나도 없다')

  return {
    color,
    width: Number(required(root.width, 'svg width')),
    height: Number(required(root.height, 'svg height')),
    viewBox: required(root.viewBox, 'viewBox'),
    periodMs: seconds * 1000,
    timingFunction: normalizeTimingFunction(
      decl(baseRule, 'animation-timing-function', '.s 의 animation-timing-function')
    ),
    transformBox: decl(baseRule, 'transform-box', '.s 의 transform-box'),
    transformOrigin: decl(baseRule, 'transform-origin', '.s 의 transform-origin'),
    baseOpacity: decl(baseRule, 'opacity', '.s 의 opacity'),
    marks,
    reducedMotionMark: reducedMark,
    reducedMotionStops: /\.s\s*\{\s*animation:\s*none\s*\}/.test(reduced)
  }
}

/** 커밋된 원본의 원문. 변조 fixture 는 이 문자열을 바꿔 파서에 다시 넣는다. */
export function readSpinnerReferenceText(): string {
  return readFileSync(fileURLToPath(REFERENCE_URL), 'utf8')
}
