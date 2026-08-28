// 0208 — 값싼 프레임 인코딩이 **원본 아티팩트와 같은 시퀀스**를 낸다는 것을 240/240 으로 잠근다.
//
// 원본(`claudecode…convergev3`)은 241 프레임을 세로로 쌓은 스프라이트 스트립이었고, 그대로
// 인라인하면 인스턴스당 ~1767 SVG 노드다. 프로덕션은 마크 7개 + CSS 트랙으로 옮겼으므로
// (`sparkFrames.ts`) **형태가 다르다** — 그래서 시퀀스 동일성이 별도 계약이다(plan D-004).
//
// ORIGINAL_FRAMES 는 원본 스트립에서 1:1 전사한 240 프레임이다(241번째는 frame 0 과 같은
// 루프 닫는 중복이라 뺐다). 규칙성이 보인다고 생성기로 재유도하지 않는다 — off-by-one 이
// 애니메이션을 조용히 바꾸고, 그때 원본과 대조할 근거가 사라진다.

import { describe, expect, it } from 'vitest'
import {
  SPARK_SEGMENT_FRAMES,
  SPARK_SEGMENT_PHASE,
  SPARK_SEGMENT_SCALES,
  SPARK_SHAPES,
  SPARK_SHAPE_WINDOWS,
  SPARK_TOTAL_FRAMES,
  scaleAtFrame,
  shapeAtFrame,
  type SparkShape
} from './sparkFrames'

/** 원본 스트립 전사본 — `[마크, scale]` 240개. */
const ORIGINAL_FRAMES: readonly (readonly [SparkShape, number])[] = [
  ['spoke', 1],
  ['spoke', 0.93],
  ['spoke', 0.84],
  ['spoke', 0.74],
  ['spoke', 0.63],
  ['spoke', 0.53],
  ['spoke', 0.45],
  ['spoke', 0.39],
  ['spoke', 0.36],
  ['spoke', 0.34],
  ['dot', 1],
  ['✢', 0.34],
  ['✢', 0.39],
  ['✢', 0.46],
  ['✢', 0.54],
  ['✢', 0.63],
  ['✢', 0.73],
  ['✢', 0.83],
  ['✢', 0.93],
  ['✢', 1.01],
  ['✢', 1.08],
  ['✢', 1.13],
  ['✢', 1.07],
  ['✢', 1.02],
  ['✢', 1],
  ['✢', 0.93],
  ['✢', 0.84],
  ['✢', 0.74],
  ['✢', 0.63],
  ['✢', 0.53],
  ['✢', 0.45],
  ['✢', 0.39],
  ['✢', 0.36],
  ['✢', 0.34],
  ['dot', 1],
  ['spoke', 0.34],
  ['spoke', 0.39],
  ['spoke', 0.46],
  ['spoke', 0.54],
  ['spoke', 0.63],
  ['spoke', 0.73],
  ['spoke', 0.83],
  ['spoke', 0.93],
  ['spoke', 1.01],
  ['spoke', 1.08],
  ['spoke', 1.13],
  ['spoke', 1.07],
  ['spoke', 1.02],
  ['spoke', 1],
  ['spoke', 0.93],
  ['spoke', 0.84],
  ['spoke', 0.74],
  ['spoke', 0.63],
  ['spoke', 0.53],
  ['spoke', 0.45],
  ['spoke', 0.39],
  ['spoke', 0.36],
  ['spoke', 0.34],
  ['dot', 1],
  ['✳︎', 0.34],
  ['✳︎', 0.39],
  ['✳︎', 0.46],
  ['✳︎', 0.54],
  ['✳︎', 0.63],
  ['✳︎', 0.73],
  ['✳︎', 0.83],
  ['✳︎', 0.93],
  ['✳︎', 1.01],
  ['✳︎', 1.08],
  ['✳︎', 1.13],
  ['✳︎', 1.07],
  ['✳︎', 1.02],
  ['✳︎', 1],
  ['✳︎', 0.93],
  ['✳︎', 0.84],
  ['✳︎', 0.74],
  ['✳︎', 0.63],
  ['✳︎', 0.53],
  ['✳︎', 0.45],
  ['✳︎', 0.39],
  ['✳︎', 0.36],
  ['✳︎', 0.34],
  ['dot', 1],
  ['spoke', 0.34],
  ['spoke', 0.39],
  ['spoke', 0.46],
  ['spoke', 0.54],
  ['spoke', 0.63],
  ['spoke', 0.73],
  ['spoke', 0.83],
  ['spoke', 0.93],
  ['spoke', 1.01],
  ['spoke', 1.08],
  ['spoke', 1.13],
  ['spoke', 1.07],
  ['spoke', 1.02],
  ['spoke', 1],
  ['spoke', 0.93],
  ['spoke', 0.84],
  ['spoke', 0.74],
  ['spoke', 0.63],
  ['spoke', 0.53],
  ['spoke', 0.45],
  ['spoke', 0.39],
  ['spoke', 0.36],
  ['spoke', 0.34],
  ['dot', 1],
  ['✶', 0.34],
  ['✶', 0.39],
  ['✶', 0.46],
  ['✶', 0.54],
  ['✶', 0.63],
  ['✶', 0.73],
  ['✶', 0.83],
  ['✶', 0.93],
  ['✶', 1.01],
  ['✶', 1.08],
  ['✶', 1.13],
  ['✶', 1.07],
  ['✶', 1.02],
  ['✶', 1],
  ['✶', 0.93],
  ['✶', 0.84],
  ['✶', 0.74],
  ['✶', 0.63],
  ['✶', 0.53],
  ['✶', 0.45],
  ['✶', 0.39],
  ['✶', 0.36],
  ['✶', 0.34],
  ['dot', 1],
  ['spoke', 0.34],
  ['spoke', 0.39],
  ['spoke', 0.46],
  ['spoke', 0.54],
  ['spoke', 0.63],
  ['spoke', 0.73],
  ['spoke', 0.83],
  ['spoke', 0.93],
  ['spoke', 1.01],
  ['spoke', 1.08],
  ['spoke', 1.13],
  ['spoke', 1.07],
  ['spoke', 1.02],
  ['spoke', 1],
  ['spoke', 0.93],
  ['spoke', 0.84],
  ['spoke', 0.74],
  ['spoke', 0.63],
  ['spoke', 0.53],
  ['spoke', 0.45],
  ['spoke', 0.39],
  ['spoke', 0.36],
  ['spoke', 0.34],
  ['dot', 1],
  ['✻', 0.34],
  ['✻', 0.39],
  ['✻', 0.46],
  ['✻', 0.54],
  ['✻', 0.63],
  ['✻', 0.73],
  ['✻', 0.83],
  ['✻', 0.93],
  ['✻', 1.01],
  ['✻', 1.08],
  ['✻', 1.13],
  ['✻', 1.07],
  ['✻', 1.02],
  ['✻', 1],
  ['✻', 0.93],
  ['✻', 0.84],
  ['✻', 0.74],
  ['✻', 0.63],
  ['✻', 0.53],
  ['✻', 0.45],
  ['✻', 0.39],
  ['✻', 0.36],
  ['✻', 0.34],
  ['dot', 1],
  ['spoke', 0.34],
  ['spoke', 0.39],
  ['spoke', 0.46],
  ['spoke', 0.54],
  ['spoke', 0.63],
  ['spoke', 0.73],
  ['spoke', 0.83],
  ['spoke', 0.93],
  ['spoke', 1.01],
  ['spoke', 1.08],
  ['spoke', 1.13],
  ['spoke', 1.07],
  ['spoke', 1.02],
  ['spoke', 1],
  ['spoke', 0.93],
  ['spoke', 0.84],
  ['spoke', 0.74],
  ['spoke', 0.63],
  ['spoke', 0.53],
  ['spoke', 0.45],
  ['spoke', 0.39],
  ['spoke', 0.36],
  ['spoke', 0.34],
  ['dot', 1],
  ['✽', 0.34],
  ['✽', 0.39],
  ['✽', 0.46],
  ['✽', 0.54],
  ['✽', 0.63],
  ['✽', 0.73],
  ['✽', 0.83],
  ['✽', 0.93],
  ['✽', 1.01],
  ['✽', 1.08],
  ['✽', 1.13],
  ['✽', 1.07],
  ['✽', 1.02],
  ['✽', 1],
  ['✽', 0.93],
  ['✽', 0.84],
  ['✽', 0.74],
  ['✽', 0.63],
  ['✽', 0.53],
  ['✽', 0.45],
  ['✽', 0.39],
  ['✽', 0.36],
  ['✽', 0.34],
  ['dot', 1],
  ['spoke', 0.34],
  ['spoke', 0.39],
  ['spoke', 0.46],
  ['spoke', 0.54],
  ['spoke', 0.63],
  ['spoke', 0.73],
  ['spoke', 0.83],
  ['spoke', 0.93],
  ['spoke', 1.01],
  ['spoke', 1.08],
  ['spoke', 1.13],
  ['spoke', 1.07],
  ['spoke', 1.02]
]

describe('spark 프레임 — 원본 등가 (AT-05)', () => {
  it('전사본이 240 프레임이다', () => {
    expect(ORIGINAL_FRAMES).toHaveLength(240)
    expect(SPARK_TOTAL_FRAMES).toBe(240)
  })

  it('240 프레임 전건에서 마크와 scale 이 원본과 같다', () => {
    const mismatches: string[] = []
    for (let i = 0; i < SPARK_TOTAL_FRAMES; i += 1) {
      const [shape, scale] = ORIGINAL_FRAMES[i]
      if (shapeAtFrame(i) !== shape || scaleAtFrame(i) !== scale) {
        mismatches.push(`frame ${i}`)
      }
    }
    // 차집합으로 적는다 — "240/240" 같은 총계는 이 주장을 반증할 수 없다.
    expect(mismatches).toEqual([])
  })

  it('음성 짝 — 위상이 1 프레임 어긋나면 전건이 깨진다', () => {
    // 등가 단언이 눈을 가졌는지 본다. 위상을 잠그지 않으면 위 테스트는 아무것도 말하지 않는다.
    const shifted = (i: number): number =>
      SPARK_SEGMENT_SCALES[(i + SPARK_SEGMENT_PHASE + 1) % SPARK_SEGMENT_FRAMES]
    const broken = Array.from({ length: SPARK_TOTAL_FRAMES }, (_, i) => i).filter(
      (i) => shifted(i) !== ORIGINAL_FRAMES[i][1]
    )
    expect(broken).toHaveLength(SPARK_TOTAL_FRAMES)
  })
})

describe('spark 프레임 — 인코딩이 기대는 구조 (AT-05 근거)', () => {
  const dotFrames = (): number[] =>
    ORIGINAL_FRAMES.flatMap(([shape], i) => (shape === 'dot' ? [i] : []))

  it('dot 은 24 프레임마다 1 프레임이다', () => {
    expect(dotFrames()).toEqual([10, 34, 58, 82, 106, 130, 154, 178, 202, 226])
  })

  it('세그먼트 9개의 scale 시퀀스가 전부 같다 — 단일 pulse 트랙의 근거', () => {
    const dots = dotFrames()
    const segs = dots.slice(0, -1).map((a, k) =>
      ORIGINAL_FRAMES.slice(a + 1, dots[k + 1] + 1)
        .map(([, scale]) => scale)
        .join(',')
    )
    expect(new Set(segs).size).toBe(1)
    expect(segs[0].split(',')).toHaveLength(SPARK_SEGMENT_FRAMES)
  })

  it('마크 런 시퀀스가 원본과 같다', () => {
    const runs: [SparkShape, number][] = []
    for (const [shape] of ORIGINAL_FRAMES) {
      const last = runs[runs.length - 1]
      if (last && last[0] === shape) last[1] += 1
      else runs.push([shape, 1])
    }
    expect(runs).toEqual([
      ['spoke', 10],
      ['dot', 1],
      ['✢', 23],
      ['dot', 1],
      ['spoke', 23],
      ['dot', 1],
      ['✳︎', 23],
      ['dot', 1],
      ['spoke', 23],
      ['dot', 1],
      ['✶', 23],
      ['dot', 1],
      ['spoke', 23],
      ['dot', 1],
      ['✻', 23],
      ['dot', 1],
      ['spoke', 23],
      ['dot', 1],
      ['✽', 23],
      ['dot', 1],
      ['spoke', 13]
    ])
  })

  it('고유 마크 7종이 전부 구간을 갖는다', () => {
    const used = new Set(ORIGINAL_FRAMES.map(([shape]) => shape))
    expect([...used].sort()).toEqual([...SPARK_SHAPES].sort())
    for (const shape of SPARK_SHAPES) {
      expect(SPARK_SHAPE_WINDOWS[shape].length).toBeGreaterThan(0)
    }
  })
})
