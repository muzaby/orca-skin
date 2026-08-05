// 도구 결과 렌더러 (0164 r2, r3 에서 2종). 요점은 하나다 — **본문을 감싸지 않는다.**
// 이전 구현이 `JSON.stringify` 로 감싸는 바람에 Markdown 줄바꿈이 `\n` 두 글자로 새어 나왔다.

import { describe, expect, it } from 'vitest'
import type {
  ConfluencePageResult,
  ConfluencePagesResult,
  ConfluenceSearchResult
} from './connector'
import { renderPagesResult, renderSearchResult } from './search-render'

function page(overrides: Partial<ConfluencePageResult> = {}): ConfluencePageResult {
  return {
    pageId: '1',
    title: '센서 스펙',
    spaceKey: 'QA',
    version: 3,
    directory: '/downloads/confluence-dc/1',
    markdownPath: '/downloads/confluence-dc/1/page.md',
    markdownPreview: '# 센서 스펙\n\n| 항목 | 값 |\n| --- | --- |\n| 해상도 | 12MP |',
    previewTruncated: false,
    assets: [],
    failedAssets: [],
    unreferencedAttachments: [],
    unhandledMacros: [],
    ...overrides
  }
}

function searchResult(overrides: Partial<ConfluenceSearchResult> = {}): ConfluenceSearchResult {
  return {
    hits: [{ id: '1', title: '센서 스펙', type: 'page', author: '홍길동', spaceKey: 'QA' }],
    start: 0,
    limit: 50,
    size: 1,
    totalSize: 1,
    ...overrides
  }
}

function pagesResult(overrides: Partial<ConfluencePagesResult> = {}): ConfluencePagesResult {
  return { pages: [page()], failedPages: [], skippedPageIds: [], ...overrides }
}

describe('renderSearchResult', () => {
  it('id·제목·작성자를 한 줄로 싣는다', () => {
    const text = renderSearchResult(searchResult())
    expect(text).toContain('센서 스펙 (pageId: 1, 작성자: 홍길동, space: QA)')
  })

  it('작성자가 없으면 그 자리를 비워 둔다', () => {
    const text = renderSearchResult(
      searchResult({ hits: [{ id: '1', title: '센서 스펙', type: 'page' }] })
    )
    expect(text).toContain('센서 스펙 (pageId: 1)')
    expect(text).not.toContain('작성자')
  })

  it('본문을 읽는 다음 도구를 가리킨다', () => {
    expect(renderSearchResult(searchResult())).toContain('confluence_get_pages')
  })

  it('범위와 전체 건수를 알려 준다', () => {
    const text = renderSearchResult(
      searchResult({
        hits: [
          { id: '3', title: 'a', type: 'page' },
          { id: '4', title: 'b', type: 'page' }
        ],
        start: 2,
        size: 2,
        totalSize: 9
      })
    )
    expect(text).toContain('3–4')
    expect(text).toContain('전체 9건')
  })

  it('다음 오프셋을 계산해서 준다 — 모델이 더하게 하지 않는다', () => {
    // 서버가 limit 을 낮춘 경우 모델이 요청값을 더하면 결과를 건너뛴다.
    const text = renderSearchResult(
      searchResult({ limit: 25, size: 25, totalSize: 120, nextStart: 25 })
    )
    expect(text).toContain('start: 25')
  })

  it('마지막 페이지에는 다음 호출 안내가 없다', () => {
    expect(renderSearchResult(searchResult())).not.toContain('start:')
  })

  it('결과가 없으면 그렇게 말하고, 오프셋 끝이면 그 사실을 구분한다', () => {
    expect(renderSearchResult(searchResult({ hits: [], size: 0 }))).toBe('검색 결과가 없습니다.')
    expect(renderSearchResult(searchResult({ hits: [], size: 0, start: 50 }))).toContain(
      'offset 50 이후'
    )
  })

  it('형상이 어긋난 값에도 던지지 않는다', () => {
    for (const bad of [null, undefined, {}, 'text', 42]) {
      expect(() => renderSearchResult(bad)).not.toThrow()
    }
  })
})

describe('renderPagesResult', () => {
  it('Markdown 본문을 그대로 싣는다 — 줄바꿈이 살아 있다', () => {
    const text = renderPagesResult(pagesResult())
    expect(text).toContain('| 항목 | 값 |\n| --- | --- |\n| 해상도 | 12MP |')
    // 이스케이프된 줄바꿈도, JSON 키도 없어야 한다.
    expect(text).not.toContain('\\n')
    expect(text).not.toContain('"markdownPreview"')
  })

  it('머리말에 pageId·공간·저장 경로를 남긴다', () => {
    const text = renderPagesResult(pagesResult())
    expect(text).toContain('pageId: 1')
    expect(text).toContain('space: QA')
    expect(text).toContain('/downloads/confluence-dc/1/page.md')
  })

  it('내려받은 첨부와 실패한 첨부를 함께 보고한다', () => {
    const text = renderPagesResult(
      pagesResult({
        pages: [
          page({
            assets: [{ filename: 'diagram.png', path: '/d/assets/diagram.png', bytes: 10 }],
            failedAssets: [{ filename: 'big.zip', message: '크기 초과' }],
            unhandledMacros: ['jira']
          })
        ]
      })
    )
    expect(text).toContain('diagram.png')
    expect(text).toContain('big.zip(크기 초과)')
    // 조용한 내용 소실을 만들지 않는다.
    expect(text).toContain('jira')
  })

  // 0168 — "첨부 없는 페이지" 와 "이미지 참조를 못 알아본 페이지" 를 문장으로 가른다.
  it('참조를 못 찾았는데 첨부가 있으면 그 사실을 말한다', () => {
    const text = renderPagesResult(
      pagesResult({
        pages: [page({ assets: [], unreferencedAttachments: ['diagram.png', 'b.png'] })]
      })
    )
    expect(text).toContain('본문에서 이미지 참조를 찾지 못했습니다')
    expect(text).toContain('diagram.png, b.png')
  })

  it('내려받은 첨부와 참조 밖 첨부를 함께 보고한다', () => {
    const text = renderPagesResult(
      pagesResult({
        pages: [
          page({
            assets: [{ filename: 'diagram.png', path: '/d/assets/diagram.png', bytes: 10 }],
            unreferencedAttachments: ['회의록.pdf']
          })
        ]
      })
    )
    expect(text).toContain('내려받은 첨부 1개')
    expect(text).toContain('본문이 참조하지 않아 받지 않은 첨부 1개: 회의록.pdf')
    // 받은 것이 있으므로 "못 찾았다" 로 말하지 않는다.
    expect(text).not.toContain('찾지 못했습니다')
  })

  it('본문을 못 가져온 페이지를 실패로 보고한다', () => {
    const text = renderPagesResult(
      pagesResult({ pages: [], failedPages: [{ pageId: '9', message: '403' }] })
    )
    expect(text).toContain('9(403)')
  })

  it('상한을 넘긴 id 를 그대로 돌려준다 — 다음 호출로 이어갈 수 있게', () => {
    const text = renderPagesResult(pagesResult({ skippedPageIds: ['51', '52'] }))
    expect(text).toContain('51, 52')
  })

  it('형상이 어긋난 값에도 던지지 않는다', () => {
    for (const bad of [null, undefined, {}, 'text', 42]) {
      expect(() => renderPagesResult(bad)).not.toThrow()
    }
  })
})
