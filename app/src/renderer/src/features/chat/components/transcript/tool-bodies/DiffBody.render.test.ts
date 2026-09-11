import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import type { ThemedToken } from 'shiki'
import type { DiffLine } from '../../../lib/diffLines'
import { DiffBody } from './DiffBody'
import type { ToolCall } from '../../../reducer/chatReducer'

// 토큰 유무를 케이스마다 바꾼다 — shiki 로드는 effect 라 정적 렌더에서는 돌지 않는다.
let tokensOn = false
vi.mock('../../../hooks/useDiffSyntax', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useDiffSyntax')>()
  return {
    ...actual,
    useDiffSyntax: (lines: readonly DiffLine[]) =>
      new Map(
        tokensOn
          ? lines.map((line) => [
              line,
              {
                old: [{ content: line.text, color: '#112233' }] as ThemedToken[],
                new: [{ content: line.text, color: '#445566' }] as ThemedToken[]
              }
            ])
          : []
      )
  }
})

const patchHunk = {
  oldStart: 45,
  oldLines: 2,
  newStart: 45,
  newLines: 2,
  lines: [
    '   const frame = 0',
    '-async function animate(): Promise<void> {',
    '+async function animate2(): Promise<void> {'
  ]
}

const editCall = (structuredOutput?: unknown): ToolCall => ({
  toolUseId: 'e1',
  name: 'Edit',
  input: {
    file_path: 'C:/w/hello_world.ts',
    old_string: 'animate',
    new_string: 'animate2'
  },
  result: { output: 'updated', isError: false, ...(structuredOutput ? { structuredOutput } : {}) }
})

function render(call: ToolCall): ReturnType<typeof load> {
  return load(renderToStaticMarkup(createElement(DiffBody, { call })))
}

function rows($: ReturnType<typeof load>): { lineNo: string; gutter: string; text: string }[] {
  return $('tr')
    .map((_, tr) => {
      const cells = $(tr).find('pre')
      return {
        lineNo: cells.eq(0).text(),
        gutter: cells.eq(1).text().trim(),
        text: cells.eq(2).text()
      }
    })
    .get()
}

describe('편집 도구 카드 본문 (0228)', () => {
  it('구조화 패치가 있으면 실제 파일 줄번호와 줄 전체를 그린다 (AC6·AC7)', () => {
    tokensOn = false
    const table = rows(render(editCall({ structuredPatch: [patchHunk] })))
    expect(table).toEqual([
      { lineNo: '45', gutter: '', text: '  const frame = 0' },
      { lineNo: '46', gutter: '-', text: 'async function animate(): Promise<void> {' },
      { lineNo: '46', gutter: '+', text: 'async function animate2(): Promise<void> {' }
    ])
  })

  it('패치가 없으면 입력 쌍 렌더로 폴백한다 (AC10)', () => {
    tokensOn = false
    const table = rows(render(editCall()))
    expect(table).toEqual([
      { lineNo: '1', gutter: '-', text: 'animate' },
      { lineNo: '1', gutter: '+', text: 'animate2' }
    ])
  })

  it('형태가 어긋난 패치도 폴백한다 — 잘못된 줄번호를 그리지 않는다 (AC12)', () => {
    tokensOn = false
    const table = rows(render(editCall({ structuredPatch: [{ ...patchHunk, newLines: 9 }] })))
    expect(table.map((row) => row.lineNo)).toEqual(['1', '1'])
  })

  it('Write 는 파일 전체를 1번 줄부터 추가 줄로 그린다 (D-009)', () => {
    tokensOn = false
    const table = rows(
      render({
        toolUseId: 'w1',
        name: 'Write',
        input: { file_path: 'a.ts', content: 'const a = 1\nconst b = 2\n' },
        result: { output: 'created', isError: false }
      })
    )
    expect(table).toEqual([
      { lineNo: '1', gutter: '+', text: 'const a = 1' },
      { lineNo: '2', gutter: '+', text: 'const b = 2' }
    ])
  })

  it('MultiEdit 은 편집마다 표를 하나씩 그린다 (AC10)', () => {
    tokensOn = false
    const $ = render({
      toolUseId: 'm1',
      name: 'MultiEdit',
      input: {
        file_path: 'a.ts',
        edits: [
          { old_string: 'a', new_string: 'b' },
          { old_string: 'c', new_string: 'd' }
        ]
      },
      result: { output: 'ok', isError: false }
    })
    expect($('table')).toHaveLength(2)
  })

  it('토큰이 오면 색을 입히고 원문은 보존한다 (AC8)', () => {
    tokensOn = true
    const $ = render(editCall({ structuredPatch: [patchHunk] }))
    const body = $('tr').eq(1).find('pre').eq(2)
    expect(body.find('span').attr('style')).toBe('color:#112233')
    expect(body.text()).toBe('async function animate(): Promise<void> {')
    expect($('tr').eq(2).find('pre').eq(2).find('span').attr('style')).toBe('color:#445566')
  })

  it('토큰이 없으면 색 요소 0개로 같은 본문을 그린다 (AC9)', () => {
    tokensOn = false
    const $ = render(editCall({ structuredPatch: [patchHunk] }))
    expect($('td span')).toHaveLength(0)
    expect($('tr').eq(1).find('pre').eq(2).text()).toBe('async function animate(): Promise<void> {')
  })

  it('결과도 입력도 없으면 입력 JSON 을 그대로 보인다', () => {
    tokensOn = false
    const $ = render({ toolUseId: 'x', name: 'Edit', input: null })
    expect($('table')).toHaveLength(0)
    expect($('pre').text()).toContain('null')
  })
})
