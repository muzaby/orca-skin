// 대기 표시의 스피너를 **렌더 출력**으로 잠근다. 원본과 같은가와 값이 싼가를 같은 출력에서
// 함께 본다.
//
// 소스 문자열이 아니라 렌더 출력을 보는 이유: 계약은 "StatusLine 이 세우는 스피너"이고,
// SparkSpinner 를 따로 렌더하면 소비자까지의 배선을 잠그지 못한다. 세 소비자가 분기 없이 같은
// StatusLine 을 부르므로 여기 출력이 곧 세 곳의 출력이다.
//
// 기하 기대값은 커밋된 원본 SVG 를 파싱해 얻는다 — 손으로 옮긴 값을 두지 않는다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다(0204 선례).
// useI18n 은 모듈 임포트 시 동기 초기화라 Provider 없이 렌더된다(shared/i18n/index.ts).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  parseSpinnerReference,
  readSpinnerReferenceText
} from '../../../shared/ui/sparkReference.testlib'
import { SPARK_MARKS, SPARK_TRACK_CLASS } from '../../../shared/ui/sparkTracks'
import { codeOf, walkSourceFiles } from '../../../shared/ui/sourceScan.testlib'
import { StatusLine } from './StatusLine'

const REF = parseSpinnerReference(readSpinnerReferenceText())
const RENDERER_SRC = fileURLToPath(new URL('../../../', import.meta.url))

const render = (turnStartedAt: number | null): string =>
  renderToStaticMarkup(createElement(StatusLine, { turnStartedAt }))

const count = (html: string, tag: string): number =>
  html.match(new RegExp(`<${tag}[ />]`, 'g'))?.length ?? 0

const HTML = render(Date.now())

/** 태그 원문 → 속성 맵. 속성 순서에 좌우되지 않게 맵으로 읽는다. */
function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

/** 렌더 출력에서 트랙 클래스 하나가 감싼 마크 자식 전수. */
function renderedMark(cls: string): { tag: string; attrs: Record<string, string> }[] {
  const group = new RegExp(`<g class="${cls}">([\\s\\S]*?)</g>`).exec(HTML)?.[1]
  expect(group, `${cls} 그룹이 렌더 출력에 없다`).toBeDefined()
  return [...(group ?? '').matchAll(/<(line|circle|path)\b([^>]*?)\/?>/g)].map((m) => ({
    tag: m[1],
    attrs: attrsOf(m[0])
  }))
}

describe('StatusLine — 스피너가 원본 아트워크다', () => {
  it('턴 진행 중 SVG 스피너 하나가 서고 옛 글리프는 없다', () => {
    expect(count(HTML, 'svg')).toBe(1)
    for (const glyph of ['✢', '✳︎', '✶', '✻', '✽']) {
      expect(HTML, glyph).not.toContain(glyph)
    }
    // 양성 짝 — 같은 출력에 상태 문구가 함께 있다(음성 술어만으로는 빈 출력도 통과한다).
    expect(HTML).toMatch(/aria-label="[^"]+"/)
  })

  it('턴이 없으면 아무것도 그리지 않는다', () => {
    expect(render(null)).toBe('')
    expect(HTML).not.toBe('')
  })

  it('마크 5종의 자식 태그·속성이 원본과 같다', () => {
    expect(REF.marks.map((m) => m.id)).toEqual([...SPARK_MARKS])
    for (const mark of REF.marks) {
      const actual = renderedMark(SPARK_TRACK_CLASS[mark.id])
      expect(actual, mark.id).toEqual(
        mark.nodes.map((n) => ({ tag: n.tag, attrs: { ...n.attrs } }))
      )
    }
    // 내역 합 = 총계. 스트립 회귀는 이 셋을 동시에 부풀린다.
    expect(count(HTML, 'line')).toBe(16)
    expect(count(HTML, 'circle')).toBe(3)
    expect(count(HTML, 'path')).toBe(13)
  })

  it('viewBox·색 배선은 원본을 따르고 크기만 14×14 다', () => {
    expect(HTML).toContain(`viewBox="${REF.viewBox}"`)
    // 원본은 100×100 이지만 스피너는 버블 본문(text-[14px])과 같은 치수로 선다.
    expect(HTML).toContain('<svg width="14" height="14"')
    expect(REF.width).toBe(100)
    // 색은 토큰이 준다 — 컴포넌트는 currentColor 만 상속한다.
    expect(HTML).toContain('text-spinner')
    expect(HTML).not.toContain('text-rust')
    expect(HTML).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(HTML).toContain('fill="currentColor" stroke="currentColor"')
  })
})

describe('StatusLine — 세 표면이 분기 없이 같은 스피너를 받는다', () => {
  it('JSX 렌더 지점 2 곳과 SparkSpinner 소비자 1 곳이 전수다', () => {
    // 술어를 문자열로만 재면 `<StatusLineModel` 2건이 분모에 섞인다 — 여는 태그의 다음 글자가
    // 식별자가 아닌 것만 센다. 작업 타일은 세 번째 지점이 아니라 PendingAssistant 를 재사용하는
    // 세 번째 **표면**이다(plan §5).
    // 술어를 리터럴로 적으면 이 파일 자신이 분모에 오른다 — 조각으로 조립해 자기 제외
    // 예외를 만들지 않는다. 그 예외는 이 파일의 실제 회귀도 함께 가린다.
    const site = new RegExp(`<Status${'Line'}(?![A-Za-z0-9_])`, 'g')
    const consumer = new RegExp(`<Spark${'Spinner'}`)
    const files = walkSourceFiles(RENDERER_SRC)
    const sites = files.flatMap((f) => {
      const code = codeOf(readFileSync(join(RENDERER_SRC, f), 'utf8'))
      return [...code.matchAll(site)].map(() => f)
    })
    expect(sites.sort()).toEqual([
      'features/chat/components/rightpanel/SubAgentTileContent.tsx',
      'features/chat/components/transcript/PendingAssistant.tsx'
    ])
    // 그 지점들이 분기 없이 같은 컴포넌트를 받는다 — 소비자가 둘이면 variant 가 생긴 것이다.
    // 분모는 프로덕션 파일이다 — 테스트가 스피너를 렌더하는 것은 variant 가 아니다.
    const consumers = files
      .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.testlib.ts'))
      .filter((f) => consumer.test(codeOf(readFileSync(join(RENDERER_SRC, f), 'utf8'))))
    expect(consumers).toEqual(['features/chat/components/StatusLine.tsx'])
  })
})

describe('StatusLine — 스피너가 상태문구보다 크다', () => {
  it('스피너 14 · 상태문구 12 · 버블 14 가 각 자리에 그대로 있다', () => {
    // 자리를 말하는 불변식이라 세 값을 함께 단언한다 — 12 와 14 를 맞바꾼 회귀가
    // "두 문자열이 모두 남아 있다" 로 통과하지 않게 한다.
    const statusLine = codeOf(
      readFileSync(fileURLToPath(new URL('./StatusLine.tsx', import.meta.url)), 'utf8')
    )
    const bubble = codeOf(
      readFileSync(
        fileURLToPath(new URL('./transcript/AssistantMessage.tsx', import.meta.url)),
        'utf8'
      )
    )
    expect(HTML).toContain('<svg width="14" height="14"')
    expect(statusLine).toContain('text-[12px]')
    expect(statusLine).not.toContain('text-[14px]')
    expect(bubble).toContain('text-[14px]')
  })
})

describe('StatusLine — 실시간 출력 경로를 건드리지 않는다', () => {
  it('인스턴스당 애니메이션이 마크 5개다', () => {
    // 아트워크가 바뀌어도 인스턴스 비용은 늘지 않아야 한다 — 이전 구현은 8개였다.
    const tracks = HTML.match(/animate-spark-[a-z0-9]+/g) ?? []
    expect(tracks).toHaveLength(5)
    expect(new Set(tracks).size).toBe(5)
    expect(tracks).toContain(SPARK_TRACK_CLASS.a)
  })

  it('인스턴스당 SVG 노드가 38개다', () => {
    const nodes = ['svg', 'g', 'line', 'circle', 'path'].reduce((a, t) => a + count(HTML, t), 0)
    expect(nodes).toBe(38)
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
