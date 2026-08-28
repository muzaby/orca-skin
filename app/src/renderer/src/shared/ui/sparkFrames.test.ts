// 0208 — 런타임 프레임 인코딩이 **첨부 원본과 슬롯 단위로 같다**는 것을 241/241 로 잠근다.
//
// r1 은 기대값 240행을 이 파일에 손으로 전사했다. 그러면 oracle 이 자기 전사본을 검증하는
// 허수아비가 되고, 원본이 바뀌어도 테스트가 반응하지 않으며, 실제로 원본의 **241번째 슬롯**을
// 놓쳤다. 여기서는 커밋된 원본 SVG 를 직접 파싱한다(`sparkReference.testlib.ts`).
//
// frame 240 은 frame 0 과 같은 그림이지만 약 29.8755ms 를 차지하는 **별도 슬롯**이다 — 지우면
// 남은 240 슬롯이 30ms 씩으로 늘어나 타이밍이 달라진다(D-016). 그래서 240 정규화는 회귀다.

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SPARK_FRAME_MS,
  SPARK_FRAME_SCALES,
  SPARK_PERIOD_MS,
  SPARK_SHAPES,
  SPARK_SHAPE_WINDOWS,
  SPARK_TOTAL_FRAMES,
  frameKeyTimePct,
  scaleAtFrame,
  shapeAtFrame,
  type SparkShape
} from './sparkFrames'
import {
  parseSpinnerReference,
  readSpinnerReferenceText,
  type SpinnerReference
} from './sparkReference.testlib'

const REFERENCE_TEXT = readSpinnerReferenceText()
const REF = parseSpinnerReference(REFERENCE_TEXT)

/** 원본과 대조할 수 있는 최소 인터페이스 — 회귀 모델을 같은 자리에 끼워 넣기 위해 있다. */
interface FrameModel {
  total: number
  shapeAt: (n: number) => SparkShape
  scaleAt: (n: number) => number
  keyTimeAt: (n: number) => string
}

const RUNTIME: FrameModel = {
  total: SPARK_TOTAL_FRAMES,
  shapeAt: shapeAtFrame,
  scaleAt: scaleAtFrame,
  keyTimeAt: frameKeyTimePct
}

/**
 * 원본 ↔ 모델의 불일치 전수. AT-22 는 실제 원본 + 실제 런타임으로, AT-23 은 변조한 쪽을
 * 끼워 넣어 **같은 함수**를 부른다 — 민감도를 다른 장치로 재는 것은 증거가 아니다.
 */
function mismatches(ref: SpinnerReference, model: FrameModel): string[] {
  const out: string[] = []
  if (model.total !== ref.frames.length) {
    out.push(`슬롯 수 ${model.total} != 원본 ${ref.frames.length}`)
  }
  if (ref.keyTimesPct.length !== ref.frames.length) {
    out.push(`원본 key time ${ref.keyTimesPct.length} != 프레임 ${ref.frames.length}`)
  }
  const n = Math.min(model.total, ref.frames.length)
  for (let i = 0; i < n; i++) {
    let shape: SparkShape | string
    let scale: number | string
    try {
      shape = model.shapeAt(i)
    } catch (e) {
      shape = `throw: ${(e as Error).message}`
    }
    try {
      scale = model.scaleAt(i)
    } catch (e) {
      scale = `throw: ${(e as Error).message}`
    }
    const keyTime = model.keyTimeAt(i)
    if (shape !== ref.frames[i].shape)
      out.push(`슬롯 ${i} 마크 ${String(shape)} != ${ref.frames[i].shape}`)
    if (scale !== ref.frames[i].scale)
      out.push(`슬롯 ${i} 배율 ${String(scale)} != ${ref.frames[i].scale}`)
    if (keyTime !== ref.keyTimesPct[i])
      out.push(`슬롯 ${i} key time ${keyTime} != ${ref.keyTimesPct[i]}`)
  }
  return out
}

describe('spark 원본 — 업로드 내용이 그대로 보존된다 (AT-21)', () => {
  // plan.md 와 같은 디렉터리에 사는 파일이 이 handoff 의 동일성 기준이다. 내용이 바뀌면
  // 위의 241/241 은 "바뀐 원본과 같다" 를 말하게 되므로, 원본 자체를 먼저 못박는다.
  // repository text 정규화로 EOF 에 LF 1byte 가 붙었고 그 앞 54,552 bytes 가 업로드 원본이다.
  it('업로드 SHA-256 과 바이트 수가 같다', () => {
    const bytes = Buffer.from(REFERENCE_TEXT, 'utf8')
    expect(bytes.subarray(-1).toString()).toBe('\n')
    const uploaded = bytes.subarray(0, bytes.length - 1)
    expect(uploaded).toHaveLength(54552)
    expect(createHash('sha256').update(uploaded).digest('hex')).toBe(
      '2599335fdfa6d75a47472fd7455e39abf0cad49ccfaacb6d7af21e6c7899aca0'
    )
  })

  it('XML 로 파싱되고 애니메이션 계약이 읽힌다', () => {
    // 파싱 성공만 보면 빈 파일도 통과할 수 있으므로 읽어낸 값까지 본다.
    expect(REF.color).toBe('#d97757')
    expect(REF.periodMs).toBe(7200)
    expect(REF.frames.length).toBeGreaterThan(0)
  })
})

describe('spark 프레임 — 원본과 241/241 등가 (AT-22)', () => {
  it('원본이 241 슬롯이고 마지막 슬롯이 frame 0 과 같은 그림이다', () => {
    // 분모를 원본에서 다시 센다 — 런타임 상수에 맞춰 세면 아무것도 말하지 않는다.
    expect(REF.frames).toHaveLength(241)
    expect(REF.keyTimesPct).toHaveLength(241)
    expect(REF.frames[240]).toEqual(REF.frames[0])
    // 같은 그림이지만 별도 슬롯이다 — 그래서 240 이 아니라 241 이다.
    expect(SPARK_TOTAL_FRAMES).toBe(REF.frames.length)
  })

  it('슬롯마다 마크·배율·key time 이 원본과 같다 — 불일치 0', () => {
    expect(mismatches(REF, RUNTIME)).toEqual([])
    // 양성 짝 — 실제로 241 슬롯을 비교했다(빈 원본도 "불일치 0" 을 통과한다).
    expect(REF.frames.length).toBe(241)
    expect(SPARK_FRAME_SCALES).toHaveLength(241)
  })

  it('한 바퀴 길이와 슬롯 길이가 원본에서 나온다', () => {
    expect(SPARK_PERIOD_MS).toBe(REF.periodMs)
    expect(SPARK_FRAME_MS).toBe(REF.periodMs / REF.frames.length)
    // 30ms 로 정규화하지 않는다 — 그것이 240 슬롯 회귀의 표식이다.
    expect(SPARK_FRAME_MS).not.toBe(30)
    expect(REF.timingFunction).toBe('steps(1, end)')
  })

  it('마지막 spoke 구간이 슬롯 240 까지 덮는다', () => {
    const last = SPARK_SHAPE_WINDOWS.spoke[SPARK_SHAPE_WINDOWS.spoke.length - 1]
    expect(last[1]).toBe(240)
  })
})

describe('spark 프레임 — 등가 oracle 이 눈을 가진다 (AT-23)', () => {
  const reparse = (mutate: (text: string) => string): SpinnerReference =>
    parseSpinnerReference(mutate(REFERENCE_TEXT))

  it('마지막 슬롯을 지운 원본과는 불일치가 난다', () => {
    const ref = reparse((t) =>
      t.replace(
        /\n {4}<g transform="translate\(0 24000\)">\n {6}<use href="#ten-spoked"\/>\n {4}<\/g>/,
        ''
      )
    )
    expect(ref.frames).toHaveLength(240)
    expect(mismatches(ref, RUNTIME)).not.toEqual([])
  })

  it('마지막 슬롯의 배율만 바꿔도 불일치가 난다', () => {
    const ref = reparse((t) =>
      t.replace(
        '<g transform="translate(0 24000)">\n      <use href="#ten-spoked"/>',
        '<g transform="translate(0 24000)">\n      <g transform="translate(50 50) scale(0.5) translate(-50 -50)">\n        <use href="#ten-spoked"/>\n      </g>'
      )
    )
    expect(ref.frames[240].scale).toBe(0.5)
    expect(mismatches(ref, RUNTIME)).toEqual(['슬롯 240 배율 1 != 0.5'])
  })

  it('key time 한 줄만 바꿔도 불일치가 난다', () => {
    const ref = reparse((t) => t.replace('0.4149%', '0.4200%'))
    expect(mismatches(ref, RUNTIME)).toEqual(['슬롯 1 key time 0.4149 != 0.4200'])
  })

  it('마크 하나만 바꿔도 불일치가 난다', () => {
    const ref = reparse((t) =>
      t.replace('<circle cx="50" cy="50" r="6.8"', '<circle cx="50" cy="50" r="9.9"')
    )
    // dot 은 형상 축이라 배율/마크가 아니라 기하 단언이 잡는다 — 여기서는 글리프를 바꾼다.
    const swapped = reparse((t) => t.replace('>✢<', '>✽<'))
    expect(ref.dot.r).toBe('9.9')
    expect(mismatches(swapped, RUNTIME).length).toBeGreaterThan(0)
  })

  it('런타임을 240 슬롯으로 되돌리면 불일치가 난다', () => {
    // r1 의 모델을 그대로 재현한다: 슬롯 240 을 버리고 프레임당 30ms 로 정규화.
    const legacy: FrameModel = {
      total: 240,
      shapeAt: shapeAtFrame,
      scaleAt: scaleAtFrame,
      keyTimeAt: (n) => ((n / 240) * 100).toFixed(4)
    }
    const found = mismatches(REF, legacy)
    expect(found[0]).toBe('슬롯 수 240 != 원본 241')
    // 슬롯 길이가 달라졌으므로 key time 도 슬롯 1 부터 전부 어긋난다.
    expect(found.filter((m) => m.includes('key time'))).toHaveLength(239)
  })

  it('원본 파일이 구조를 잃으면 파서가 던진다', () => {
    expect(() =>
      parseSpinnerReference(REFERENCE_TEXT.replace('<g class="spark-strip">', '<g>'))
    ).toThrow()
    expect(() =>
      parseSpinnerReference(REFERENCE_TEXT.replace('color:#d97757', 'colour:#d97757'))
    ).toThrow()
  })
})

describe('spark 프레임 — 인코딩이 기대는 구조', () => {
  it('마크 구간이 원본의 런 시퀀스와 같다', () => {
    // 원본에서 런을 다시 만들어 SPARK_SHAPE_WINDOWS 와 대조한다 — 창을 손으로 적지 않는다.
    const fromReference = new Map<SparkShape, [number, number][]>()
    REF.frames.forEach(({ shape }, i) => {
      const list = fromReference.get(shape) ?? []
      const last = list[list.length - 1]
      if (last && last[1] === i - 1) last[1] = i
      else list.push([i, i])
      fromReference.set(shape, list)
    })
    for (const shape of SPARK_SHAPES) {
      expect(
        SPARK_SHAPE_WINDOWS[shape].map(([a, b]) => [a, b]),
        shape
      ).toEqual(fromReference.get(shape))
    }
    // 양성 짝 — 원본에 실제로 마크 7종이 있다.
    expect([...fromReference.keys()].sort()).toEqual([...SPARK_SHAPES].sort())
  })

  it('글리프 5종이 원본 등장 순서 그대로다', () => {
    expect(REF.glyphs).toEqual(['✢', '✳︎', '✶', '✻', '✽'])
    expect(SPARK_SHAPES.slice(2)).toEqual(REF.glyphs)
  })

  it('구간 밖 슬롯을 물으면 던진다', () => {
    expect(() => shapeAtFrame(SPARK_TOTAL_FRAMES)).toThrow()
    expect(() => scaleAtFrame(SPARK_TOTAL_FRAMES)).toThrow()
  })
})
