import { describe, it, expect, vi } from 'vitest'
import {
  advanceStableBlocks,
  openFenceTail,
  splitStableBlocks,
  type StableBlocksCache
} from './markdownBlocks'

describe('splitStableBlocks', () => {
  it('문단 사이 빈 줄에서 확정 블록을 자르고 마지막 블록은 꼬리로 남긴다', () => {
    const { stable, tail } = splitStableBlocks('첫 문단.\n\n둘째 문단.\n\n셋째 줄.\n작성 중')
    expect(stable).toEqual(['첫 문단.', '둘째 문단.'])
    expect(tail).toBe('셋째 줄.\n작성 중')
  })

  it('경계 없는 단일 문단은 전부 꼬리', () => {
    const { stable, tail } = splitStableBlocks('아직 한 문단')
    expect(stable).toEqual([])
    expect(tail).toBe('아직 한 문단')
  })

  it('펜스 코드블록 내부의 빈 줄에서는 자르지 않는다 (미닫힘 펜스 포함)', () => {
    const closed = splitStableBlocks(
      '소개.\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\n끝.\n\n남은 줄.\nx'
    )
    expect(closed.stable).toEqual(['소개.', '```ts\nconst a = 1\n\nconst b = 2\n```', '끝.'])
    expect(closed.tail).toBe('남은 줄.\nx')

    const open = splitStableBlocks('소개.\n\n```ts\nconst a = 1\n\n아직 펜스 안')
    expect(open.stable).toEqual(['소개.'])
    expect(open.tail).toBe('```ts\nconst a = 1\n\n아직 펜스 안')
  })

  it('loose list(항목 사이 빈 줄)는 자르지 않는다 — ol 번호/마진 보존', () => {
    const { stable, tail } = splitStableBlocks('1. one\n\n2. two\n\n3. three 작성중')
    expect(stable).toEqual([])
    expect(tail).toBe('1. one\n\n2. two\n\n3. three 작성중')
  })

  it('문단 → 리스트 경계도 자르지 않는다 (리스트는 꼬리에 붙어 자란다)', () => {
    const { stable, tail } = splitStableBlocks('머리말.\n\n- a\n- b\n진행')
    expect(stable).toEqual([])
    expect(tail).toBe('머리말.\n\n- a\n- b\n진행')
  })

  it('keeps a loose list continuation on the same side of the stable boundary', () => {
    const source = '- first item\n\n  continued paragraph\n'
    expect(splitStableBlocks(source)).toEqual({ stable: [], tail: source })
  })

  it('들여쓰기 코드블록 경계는 자르지 않는다', () => {
    const { stable } = splitStableBlocks(
      '설명.\n\n    indented code\n\n다음 문단.\n\n완결 줄.\n꼬리'
    )
    // 설명↔코드, 코드↔다음 문단 둘 다 보호 — "다음 문단." 뒤 경계만 유효.
    expect(stable).toEqual(['설명.\n\n    indented code\n\n다음 문단.'])
  })

  it('경계 뒤에 완결된 비공백 줄이 없으면 미확정(꼬리 유지) — append 로 뒤집히지 않는 경계만 확정', () => {
    // 빈 줄 다음에 아직 미종결(개행 없는) 텍스트만 있는 상태.
    const partial = splitStableBlocks('문단.\n\n다음 시작')
    expect(partial.stable).toEqual([])
    expect(partial.tail).toBe('문단.\n\n다음 시작')

    // 같은 소스가 자라 다음 줄이 완결되면 그때 확정 — 기존 확정 블록 집합은 불변(append-stable).
    const grown = splitStableBlocks('문단.\n\n다음 시작 완결.\n그리고')
    expect(grown.stable).toEqual(['문단.'])
    expect(grown.tail).toBe('다음 시작 완결.\n그리고')
  })

  it('stable 블록 문자열은 소스가 자라도 불변(prefix 결정적) — memo 영구 적중 보장', () => {
    const a = '첫.\n\n둘째.\n\n셋째 진행'
    const b = a + ' 중이고\n\n넷째 줄.\n\n다섯'
    const sa = splitStableBlocks(a)
    const sb = splitStableBlocks(b)
    expect(sb.stable.slice(0, sa.stable.length)).toEqual(sa.stable)
  })
})

// 증분 분할(0108) — 임의 append 시퀀스에서 전체 스캔(splitStableBlocks)과 결과 동치.
describe('advanceStableBlocks', () => {
  // 경계 조건을 두루 건드리는 코퍼스 — 펜스(열림/닫힘/미닫힘)·loose list·들여쓰기 코드·
  // 빈 줄 런·미완 마지막 줄.
  const FULL_SOURCE = [
    '첫 문단이다.',
    '',
    '둘째 문단이고 조금 길다.',
    '',
    '```ts',
    'const a = 1',
    '',
    'const b = 2',
    '```',
    '',
    '- 항목 1',
    '',
    '- 항목 2 (loose)',
    '',
    '셋째 문단.',
    '',
    '    indented code',
    '',
    '넷째 문단.',
    '',
    '~~~',
    '미닫힘 펜스 시작',
    '',
    '아직 안 닫힘'
  ].join('\n')

  function chunksOf(source: string, sizes: number[]): string[] {
    const out: string[] = []
    let at = 0
    let i = 0
    while (at < source.length) {
      const n = sizes[i % sizes.length]
      out.push(source.slice(0, Math.min(source.length, at + n)))
      at += n
      i++
    }
    return out
  }

  it('여러 청크 크기의 append 시퀀스에서 splitStableBlocks(전문)과 동치', () => {
    for (const sizes of [[1], [3], [7, 2], [16, 5, 1], [64]]) {
      let cache: StableBlocksCache | null = null
      for (const partial of chunksOf(FULL_SOURCE, sizes)) {
        const inc = advanceStableBlocks(cache, partial)
        cache = inc.cache
        const full = splitStableBlocks(partial)
        expect(inc.stable).toEqual(full.stable)
        expect(inc.tail).toBe(full.tail)
      }
    }
  })

  it('append 가 아니면(소스 교체) 전체 재계산으로 폴백한다', () => {
    const first = advanceStableBlocks(null, '가.\n\n나.\n\n다')
    const replaced = advanceStableBlocks(first.cache, '전혀 다른 소스.\n\n둘째.\n\n셋')
    const full = splitStableBlocks('전혀 다른 소스.\n\n둘째.\n\n셋')
    expect(replaced.stable).toEqual(full.stable)
    expect(replaced.tail).toBe(full.tail)
  })

  it('stable 미증가 프레임에서는 기존 stable 배열 참조를 유지한다 (memo 친화)', () => {
    const a = advanceStableBlocks(null, '문단.\n\n꼬리 자라는')
    const b = advanceStableBlocks(a.cache, '문단.\n\n꼬리 자라는 중')
    expect(b.stable).toBe(a.stable)
  })
})

describe('openFenceTail & incremental scanState (EP-19 f1~f9·f11~f13)', () => {
  it('checks standalone tail boundaries and rejects mismatched cached body offsets', () => {
    for (const source of ['', ' \t\r\n', '~~~', 'prose\n~~~\n', '~~~\nbody\n~~~']) {
      expect(openFenceTail(source)).toBeNull()
    }
    const standalone = '\t\r\n ~~~js\r\n body\r\nlast'
    expect(openFenceTail(standalone)).toEqual({
      char: '~',
      length: 3,
      indent: 1,
      lang: 'js',
      code: 'body\nlast'
    })
    const input = '~~~\n'
    const scan = advanceStableBlocks(null, input).scanState
    const fence = scan.fence!
    for (const bodyStart of [-1, input.length + 1]) {
      expect(openFenceTail(input, { ...scan, fence: { ...fence, bodyStart } })).toBeNull()
    }
    expect(openFenceTail(input, scan)?.code).toBe('')
  })

  it('f1~f7: CommonMark fence opening/closing rules and CRLF', () => {
    // f1: 열린 백틱 펜스 + info
    const f1 = advanceStableBlocks(null, '```ts\nconst x = 1\n')
    expect(f1.openFence).toEqual({
      char: '`',
      length: 3,
      indent: 0,
      lang: 'ts',
      code: 'const x = 1'
    })

    // f2: ~~~~ 열림 + ~~~ 줄은 닫힘 아님
    const f2 = advanceStableBlocks(null, '~~~~py\nprint(1)\n~~~\nprint(2)\n')
    expect(f2.openFence).toEqual({
      char: '~',
      length: 4,
      indent: 0,
      lang: 'py',
      code: 'print(1)\n~~~\nprint(2)'
    })

    // f3: 닫힘 줄 -> null
    const f3 = advanceStableBlocks(null, '```ts\nconst x = 1\n```\n')
    expect(f3.openFence).toBeNull()

    // f4: 백틱 info 안 백틱 -> 펜스 아님 -> null
    const f4 = advanceStableBlocks(null, '```a`b\nconst x = 1\n')
    expect(f4.openFence).toBeNull()

    // f5: 닫힘 후보 뒤 문자 -> 닫힘 아님 -> 값 유지
    const f5 = advanceStableBlocks(null, '```ts\nconst x = 1\n```x\n')
    expect(f5.openFence).toEqual({
      char: '`',
      length: 3,
      indent: 0,
      lang: 'ts',
      code: 'const x = 1\n```x'
    })

    // f6: 들여쓰기 3 -> 값, 4 -> null
    const f6a = advanceStableBlocks(null, '   ```js\n   const a = 1\n')
    expect(f6a.openFence).toEqual({
      char: '`',
      length: 3,
      indent: 3,
      lang: 'js',
      code: 'const a = 1'
    })
    const f6b = advanceStableBlocks(null, '    ```js\nconst a = 1\n')
    expect(f6b.openFence).toBeNull()

    // f7: CRLF 줄끝은 LF 와 같은 판정
    const f7Open = advanceStableBlocks(null, '```ts\r\nconst a = 1\r\n')
    expect(f7Open.openFence?.code).toBe('const a = 1')
    const f7Closed = advanceStableBlocks(null, '```ts\r\nconst a = 1\r\n```\r\n')
    expect(f7Closed.openFence).toBeNull()
  })

  it('applies CommonMark closer rules to newly completed lines across chunks', () => {
    const opener = '   ~~~~lang`ok metadata\r\n'
    const body = '   alpha\r\n   beta\r\n'
    const initial = advanceStableBlocks(null, opener + body)
    expect(initial.openFence).toEqual({
      char: '~',
      length: 4,
      indent: 3,
      lang: 'lang`ok',
      code: 'alpha\nbeta'
    })
    for (const invalid of ['````', '~~~', '    ~~~~', '~~~~x']) {
      const next = advanceStableBlocks(initial.cache, opener + body + invalid + '\r\n')
      expect(next.openFence?.code).toContain(invalid.trimStart())
    }
    for (const valid of ['~~~~', '   ~~~~~ \t']) {
      const next = advanceStableBlocks(initial.cache, opener + body + valid + '\r\n')
      expect(next.openFence).toBeNull()
    }
    expect(advanceStableBlocks(null, 'paragraph\n' + opener + body).openFence).toBeNull()
  })

  it('f8: 100,000 chars in 2,000 x 50-char deltas scans ~100,000 chars total', () => {
    const bodyLine = 'const value = 12345678901234567890123456789012345\n' // 50 chars
    const full = '```ts\n' + bodyLine.repeat(1999) + 'x'.repeat(44)
    expect(full.length).toBe(100_000)

    let cache: StableBlocksCache | null = null
    let last = advanceStableBlocks(null, '')
    for (let pos = 50; pos <= full.length; pos += 50) {
      last = advanceStableBlocks(cache, full.slice(0, pos))
      cache = last.cache
    }
    expect(last.openFence).not.toBeNull()
    expect(last.scanState.scannedChars).toBeLessThanOrEqual(full.length + 50)
    expect(last.scanState.scannedChars).toBeGreaterThanOrEqual(full.length - 50)
  })

  it('f8·f12: starts each actual newline search at the previously checked offset', () => {
    const search = vi.spyOn(String.prototype, 'indexOf')
    let offsets: Array<number | undefined>
    try {
      let cache: StableBlocksCache | null = null
      for (let size = 50; size <= 50_000; size += 50) {
        cache = advanceStableBlocks(cache, 'a'.repeat(size)).cache
      }
      offsets = search.mock.calls.filter(([needle]) => needle === '\n').map(([, start]) => start)
    } finally {
      search.mockRestore()
    }
    expect(offsets).toEqual(Array.from({ length: 1_000 }, (_, index) => index * 50))
  })

  it('f9: fence opening line split across deltas gives identical result', () => {
    let cache: StableBlocksCache | null = null
    const chunks = ['``', '`ts\n', 'const a = 1\n']
    let acc = ''
    let result = advanceStableBlocks(null, '')
    for (const chunk of chunks) {
      acc += chunk
      result = advanceStableBlocks(cache, acc)
      cache = result.cache
    }
    expect(result.openFence).toEqual({
      char: '`',
      length: 3,
      indent: 0,
      lang: 'ts',
      code: 'const a = 1'
    })
  })

  it('f11·f12·f13: unfinished last line, 50,000-char line without newline, and closing fence without trailing newline', () => {
    // f11: 열린 펜스의 미완성 마지막 줄도 코드 블록에 포함
    const f11 = advanceStableBlocks(null, '```ts\nconst a = 1\nconst b = 2')
    expect(f11.openFence?.code).toBe('const a = 1\nconst b = 2')

    // f12: 개행 없는 긴 줄 50,000자를 1,000 delta 로 -> 누적 스캔 문자 = 입력 길이
    const longLine = 'a'.repeat(50_000)
    let cache: StableBlocksCache | null = null
    let last = advanceStableBlocks(null, '')
    for (let pos = 50; pos <= longLine.length; pos += 50) {
      last = advanceStableBlocks(cache, longLine.slice(0, pos))
      cache = last.cache
    }
    expect(last.scanState.scannedChars).toBe(50_000)
    expect(last.tail).toBe(longLine)

    // f13: 마지막 개행 없이 닫힌 펜스 -> delta 중 닫힘 판정 보류 (openFence 유지)
    const f13 = advanceStableBlocks(null, '```ts\nconst a = 1\n```')
    expect(f13.openFence).not.toBeNull()
  })

  it('f10: StreamingMarkdown completed output matches Markdown DOM structure on f1~f9 inputs', async () => {
    const React = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { Markdown } = await import('../../../shared/ui/markdown/Markdown')
    const { StreamingMarkdown } = await import('../components/markdown/StreamingMarkdown')

    const samples = [
      '```ts\nconst x = 1\n```\n',
      '~~~~py\nprint(1)\n~~~\nprint(2)\n~~~~\n',
      '```a`b\nnot a fence\n',
      '```ts\nconst x = 1\n```x\n```\n',
      '   ```js\n   const a = 1\n   ```\n',
      '```ts\r\nconst a = 1\r\n```\r\n'
    ]
    for (const sample of samples) {
      const streamingHtml = renderToStaticMarkup(
        React.createElement(StreamingMarkdown, { source: sample })
      ).replace(/^<div class="flex flex-col gap-2">([\s\S]*)<\/div>$/, '$1')
      const fullHtml = renderToStaticMarkup(React.createElement(Markdown, { source: sample }))
      expect(streamingHtml).toBe(fullHtml)
    }
  })
})
