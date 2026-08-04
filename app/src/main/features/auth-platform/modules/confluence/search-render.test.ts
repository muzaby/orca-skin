// 검색 결과 렌더러 (0164 r2). 요점은 하나다 — **본문을 감싸지 않는다.**
// 이전 구현이 `JSON.stringify` 로 감싸는 바람에 Markdown 줄바꿈이 `\n` 두 글자로 새어 나왔다.

import { describe, expect, it } from 'vitest'
import type { ConfluencePageResult, ConfluenceSearchResult } from './connector'
import { renderSearchResult } from './search-render'

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
    unhandledMacros: [],
    ...overrides
  }
}

function result(overrides: Partial<ConfluenceSearchResult> = {}): ConfluenceSearchResult {
  return {
    hits: [{ id: '1', title: '센서 스펙', type: 'page', spaceKey: 'QA' }],
    pages: [page()],
    failedPages: [],
    skippedPages: 0,
    ...overrides
  }
}

describe('renderSearchResult', () => {
  it('Markdown 본문을 그대로 싣는다 — 줄바꿈이 살아 있다', () => {
    const text = renderSearchResult(result())
    expect(text).toContain('| 항목 | 값 |\n| --- | --- |\n| 해상도 | 12MP |')
    // 이스케이프된 줄바꿈도, JSON 키도 없어야 한다.
    expect(text).not.toContain('\\n')
    expect(text).not.toContain('"markdownPreview"')
  })

  it('머리말에 pageId·공간·저장 경로를 남긴다', () => {
    const text = renderSearchResult(result())
    expect(text).toContain('pageId: 1')
    expect(text).toContain('space: QA')
    expect(text).toContain('/downloads/confluence-dc/1/page.md')
  })

  it('내려받은 첨부와 실패한 첨부를 함께 보고한다', () => {
    const text = renderSearchResult(
      result({
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

  it('상한에 걸려 펼치지 않은 hit 은 목록으로 남긴다', () => {
    const text = renderSearchResult(
      result({
        hits: [
          { id: '1', title: '센서 스펙', type: 'page' },
          { id: '2', title: '캘리브레이션', type: 'page' }
        ],
        skippedPages: 1
      })
    )
    expect(text).toContain('본문을 펼치지 않은 검색 결과')
    expect(text).toContain('캘리브레이션 (pageId: 2)')
    expect(text).not.toContain('센서 스펙 (pageId: 1)')
  })

  it('본문을 못 가져온 페이지를 실패로 보고한다', () => {
    const text = renderSearchResult(
      result({ pages: [], failedPages: [{ pageId: '9', title: '비공개', message: '403' }] })
    )
    expect(text).toContain('비공개(403)')
  })

  it('결과가 없으면 그렇게 말한다', () => {
    expect(renderSearchResult(result({ hits: [], pages: [] }))).toBe('검색 결과가 없습니다.')
  })

  it('형상이 어긋난 값에도 던지지 않는다', () => {
    // connector 가 예기치 않은 값을 줘도 도구가 예외로 죽지 않아야 한다.
    for (const bad of [null, undefined, {}, 'text', 42]) {
      expect(() => renderSearchResult(bad)).not.toThrow()
    }
  })
})
