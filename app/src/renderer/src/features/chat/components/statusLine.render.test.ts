// 0208 — 대기 표시의 스피너를 **렌더 출력**으로 잠근다. 원본과 같은가(AT-22)와 값이 싼가
// (AT-24)를 같은 출력에서 함께 본다.
//
// 소스 문자열이 아니라 렌더 출력을 보는 이유: 계약은 "StatusLine 이 세우는 스피너"이고,
// SparkSpinner 를 따로 렌더하면 소비자까지의 배선을 잠그지 못한다. 세 소비자가 분기 없이 같은
// StatusLine 을 부르므로(D-002) 여기 출력이 곧 세 곳의 출력이다.
//
// 기하·글리프 기대값은 커밋된 원본 SVG 를 파싱해 얻는다 — 손으로 옮긴 값을 두지 않는다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다(0204 선례).
// useI18n 은 모듈 임포트 시 동기 초기화라 Provider 없이 렌더된다(shared/i18n/index.ts).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  parseSpinnerReference,
  readSpinnerReferenceText
} from '../../../shared/ui/sparkReference.testlib'
import { codeOf } from '../../../shared/ui/sourceScan.testlib'
import { StatusLine } from './StatusLine'

const REF = parseSpinnerReference(readSpinnerReferenceText())

const render = (turnStartedAt: number | null): string =>
  renderToStaticMarkup(createElement(StatusLine, { turnStartedAt }))

const count = (html: string, tag: string): number =>
  html.match(new RegExp(`<${tag}[ />]`, 'g'))?.length ?? 0

/** 렌더 출력의 속성 값 — React 가 `"` 를 `&quot;` 로 이스케이프하므로 되돌린다. */
const unescape = (s: string): string => s.replace(/&quot;/g, '"')

const HTML = render(Date.now())

describe('StatusLine — 스피너 교체 (AT-01)', () => {
  it('턴 진행 중 SVG 스피너 하나가 서고 옛 전용 글리프는 없다', () => {
    expect(count(HTML, 'svg')).toBe(1)
    for (const glyph of ['✣', '✦', '✧', '★']) {
      expect(HTML, glyph).not.toContain(glyph)
    }
    // 양성 짝 — 같은 출력에 상태 문구가 함께 있다(음성 술어만으로는 빈 출력도 통과한다).
    expect(HTML).toMatch(/aria-label="[^"]+"/)
  })

  it('턴이 없으면 아무것도 그리지 않는다', () => {
    expect(render(null)).toBe('')
    expect(HTML).not.toBe('')
  })
})

describe('StatusLine — 스피너 기하가 원본과 같다 (AT-22)', () => {
  it('바깥 svg 의 크기·viewBox 가 원본 값이다', () => {
    expect(HTML).toContain(`<svg width="${REF.width}" height="${REF.height}"`)
    expect(HTML).toContain(`viewBox="${REF.viewBox}"`)
    expect(REF.width).toBe(18)
  })

  it('spoke 10개의 좌표·회전각·stroke 가 원본 #ten-spoked 와 같다', () => {
    const { spoke } = REF
    expect(HTML).toContain(`stroke-width="${spoke.strokeWidth}"`)
    expect(HTML).toContain(`stroke-linecap="${spoke.strokeLinecap}"`)
    // 마크 고유 배율 0.74 는 슬롯 배율과 별개라 마크에 그대로 남는다.
    expect(HTML).toContain(`transform="${spoke.transform}"`)
    const lines = [...HTML.matchAll(/<line\b[^>]*>/g)].map((m) => m[0])
    expect(lines).toHaveLength(spoke.angles.length)
    const angles = lines.map((l) => Number(/rotate\((\d+)/.exec(l)?.[1] ?? 0))
    expect(angles).toEqual([...spoke.angles])
    for (const l of lines) {
      expect(l).toContain(`x1="${spoke.x1}" y1="${spoke.y1}" x2="${spoke.x2}" y2="${spoke.y2}"`)
    }
  })

  it('dot 과 글리프 5종의 기하·문자가 원본과 같다', () => {
    expect(HTML).toContain(`cx="${REF.dot.cx}" cy="${REF.dot.cy}" r="${REF.dot.r}"`)
    const texts = [...HTML.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)]
    expect(texts.map((m) => m[2])).toEqual([...REF.glyphs])
    for (const [, attrs] of texts) {
      expect(attrs).toContain(`x="${REF.text.x}" y="${REF.text.y}"`)
      expect(`${/font-size="(\d+)"/.exec(attrs)?.[1]}px`).toBe(REF.text.fontSize)
      expect(unescape(/font-family="([^"]*)"/.exec(attrs)?.[1] ?? '')).toBe(REF.text.fontFamily)
      expect(attrs).toContain(`text-anchor="${REF.text.textAnchor}"`)
      expect(attrs).toContain(`dominant-baseline="${REF.text.dominantBaseline}"`)
    }
  })

  it('색이 원본 고정색 토큰으로 오고 raw hex 가 없다', () => {
    // 원본은 두 테마 구분 없이 #d97757 이다. rust 토큰은 light 에서 #c96442 라 다른 색이 된다.
    expect(HTML).toContain('text-spinner')
    expect(HTML).not.toContain('text-rust')
    expect(HTML).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(HTML).toContain('currentColor')
  })
})

describe('StatusLine — 정확도를 올려도 값이 싸다 (AT-24)', () => {
  it('스트립을 펼치지 않는다 — 마크 7개 규모로 고정', () => {
    // 원본을 1:1 인라인하면 <line> 1160 · <text> 115 · <circle> 10 이다. 등호로 쓰는 이유는
    // 스트립 회귀가 이 셋을 동시에 100배로 만들기 때문이다.
    expect(count(HTML, 'line')).toBe(10)
    expect(count(HTML, 'text')).toBe(5)
    expect(count(HTML, 'circle')).toBe(1)
    // 인스턴스당 SVG 노드 상한 — 19 개(svg 1 · g 2 · line 10 · circle 1 · text 5).
    const nodes = ['svg', 'g', 'line', 'circle', 'text'].reduce((a, t) => a + count(HTML, t), 0)
    expect(nodes).toBe(19)
  })

  it('인스턴스당 애니메이션이 scale 1 + visibility 7 = 8 개다', () => {
    // 241 슬롯으로 정확도를 올린 대가가 인스턴스 비용이면 D-003 이 깨진다. 늘어난 것은
    // 전역 CSS stop 뿐이어야 한다 — 출력의 트랙 수는 r1 과 같은 8 이다.
    const tracks = HTML.match(/animate-spark-[a-z0-9]+/g) ?? []
    expect(tracks).toHaveLength(8)
    expect(new Set(tracks).size).toBe(8)
    expect(tracks).toContain('animate-spark-scale')
  })

  it('프레임 진행에 React 상태·타이머가 없다', () => {
    // 주석은 뺀다 — 산문의 언급에 반응하는 술어는 회귀를 구분하지 못한다.
    const code = codeOf(
      readFileSync(fileURLToPath(new URL('./StatusLine.tsx', import.meta.url)), 'utf8')
    )
    for (const token of ['setInterval', 'SYMBOL_INTERVAL_MS', 'symbolIdx', 'useState']) {
      expect(code, token).not.toContain(token)
    }
    // 인라인 style 로 배율을 그리면 프레임 진행이 다시 JS 로 올라온다.
    expect(code).not.toContain('style={')
    // 양성 짝 — 경과 초 훅은 남아 있다(장치가 파일을 통째로 비웠을 때 통과하지 못하게).
    expect(code).toContain('useElapsed')
    expect(code).toContain('<SparkSpinner')
  })
})
