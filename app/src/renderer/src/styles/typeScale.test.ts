// 0256 — 앱 기준 글자 · 대화 텍스트 배율 · 대화 기록 너비의 정의를 원문에서 읽는다.
//
// vitest 가 `environment: 'node'` 라 계산된 글자 크기·열 폭은 볼 수 없다. 볼 수 있는 것은
// 정의가 **어디에** 있는가(루트 14.5px · 토큰 inline 배율 · 범위 선언 자리)와 트랜스크립트
// closure 의 글자 크기가 모두 배율을 따르는가다. 렌더 크기 자체는 AC12 사람 실기다.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TRANSCRIPT_WIDTH_PX } from '../shared/config/theme'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const appCss = readFileSync(join(SRC, 'styles/app.css'), 'utf8')
const tokensCss = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')

function block(css: string, head: string): string {
  const at = css.indexOf(head)
  expect(at, `${head} 블록이 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

const SCALE = 'var(--transcript-text-scale, 1)'
const SCALED_CLASS_SUFFIX = '*var(--transcript-text-scale,1))]'

// TranscriptView.tsx 에서 상대 import 로 닿는 .tsx 전부(테스트 제외).
function transcriptClosure(): string[] {
  const start = join(SRC, 'features/chat/components/transcript/TranscriptView.tsx')
  const seen = new Set<string>()
  const stack = [start]
  const re = /(?:import|export)[^'"]*from\s+['"](\.[^'"]+)['"]/g
  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const m of readFileSync(file, 'utf8').matchAll(re)) {
      const base = resolve(dirname(file), m[1])
      const hit = ['', '.tsx', '.ts', '/index.tsx', '/index.ts']
        .map((ext) => base + ext)
        .find((p) => existsSync(p) && statSync(p).isFile())
      if (hit && hit.startsWith(SRC) && !/\.test\./.test(hit)) stack.push(hit)
    }
  }
  return [...seen]
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => relative(SRC, f).split(sep).join('/'))
}

describe('0256 AC2 — 앱 기준 글자 14.5px', () => {
  it('app.css base 의 html 블록이 루트 글자 크기를 소유한다', () => {
    const base = block(appCss, '@layer base {')
    expect(base).toMatch(/html\s*\{\s*font-size:\s*14\.5px;\s*\}/)
  })
})

describe('0256 AC8 — 타이포 토큰은 트랜스크립트 배율을 곱한다', () => {
  it.each(['caption', 'footnote', 'code', 'body', 'heading'])(
    '--text-%s 는 @theme inline 에서 배율을 곱한다',
    (name) => {
      const inline = block(tokensCss, '@theme inline {')
      expect(inline).toMatch(
        new RegExp(`--text-${name}: calc\\([0-9.]+rem \\* var\\(--transcript-text-scale, 1\\)\\);`)
      )
      expect(inline).toContain(SCALE)
      // inline 이 아닌 @theme 에 같은 토큰이 다시 정의되면 그쪽이 var 참조 유틸을 만든다.
      expect(block(tokensCss, '@theme {')).not.toMatch(new RegExp(`--text-${name}:`))
    }
  )

  it('트랜스크립트 closure 의 글자 크기는 토큰 또는 배율 calc 뿐이다', () => {
    const files = transcriptClosure()
    // 걷기 장치 생존 — 깊은 자리까지 닿아야 한다.
    for (const known of [
      'shared/ui/markdown/Markdown.tsx',
      'features/chat/harnesses/common/transcript/UserMessage.tsx',
      'features/chat/harnesses/common/transcript/StatusLine.tsx'
    ])
      expect(files).toContain(known)
    const violations: string[] = []
    for (const rel of files) {
      const src = readFileSync(join(SRC, rel), 'utf8')
      for (const m of src.matchAll(/\btext-\[([^\]]+)\]/g)) {
        const value = m[1]
        if (/^(#|var\(--color|color-mix|rgb)/.test(value)) continue
        if (value.startsWith('calc(') && m[0].endsWith(SCALED_CLASS_SUFFIX)) continue
        violations.push(`${rel}: ${m[0]}`)
      }
      for (const m of src.matchAll(/(?<![\w-])text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g))
        violations.push(`${rel}: ${m[0]}`)
      if (/fontSize\s*:/.test(src)) violations.push(`${rel}: inline fontSize`)
    }
    expect(violations).toEqual([])
  })
})

describe('0256 AC7 — 배율 수용 선언은 트랜스크립트 루트 한 곳', () => {
  it('선언 문자열을 가진 renderer 파일은 TranscriptView.tsx 하나다', () => {
    const declaration = '[--transcript-text-scale:var(--chat-text-scale,1)]'
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (
          /\.tsx?$/.test(name) &&
          !/\.test\./.test(name) &&
          readFileSync(p, 'utf8').includes(declaration)
        )
          hits.push(relative(SRC, p).split(sep).join('/'))
      }
    }
    walk(SRC)
    expect(hits).toEqual(['features/chat/components/transcript/TranscriptView.tsx'])
  })
})

describe('0256 AC9·AC10 — 대화 기록 너비', () => {
  it('tokens.css 기본값은 medium 매핑과 같다', () => {
    expect(block(tokensCss, '@theme {')).toContain(
      `--reading-column: ${TRANSCRIPT_WIDTH_PX.medium}px;`
    )
  })

  it('트랜스크립트·컴포저·프로젝트 랜딩이 같은 ReadingColumn 폭을 쓰고 랜딩은 720px 상한을 유지한다', () => {
    const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')
    expect(read('shared/ui/ReadingColumn.tsx')).toContain('max-w-[var(--reading-column)]')
    expect(read('features/chat/components/Composer.tsx')).toMatch(/<ReadingColumn\b/)
    expect(read('features/chat/harnesses/claude/transcript/Timeline.tsx')).toContain(
      '<ReadingColumn'
    )
    expect(read('pages/ProjectLandingPage.tsx')).toContain('<ReadingColumn>')
    expect(read('features/chat/components/Landing.tsx')).toContain(
      'className={landingFrame.column}'
    )
    expect(read('features/chat/components/landingFrame.ts')).toContain('max-w-[720px]')
    expect(read('pages/ProjectLandingPage.tsx')).toContain('max-w-[720px]')
  })
})
