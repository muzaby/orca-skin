// 검색 결과 → 모델에게 줄 **텍스트** (0164 r2) — 순수 함수. 네트워크·fs 의존 0.
//
// 이 파일이 생긴 이유는 하나다: 이전 구현이 `JSON.stringify(result.data, null, 2)` 를 그대로
// 실었다. Markdown 이 JSON 문자열 **안에** 들어가면 줄바꿈이 `\n` 두 글자로 이스케이프되어
// 모델에게도 사람에게도 한 줄로 보인다(사용자 보고 2026-08-04 "\n 기호를 줄바꿈으로 표시해서
// 그런듯"). 본문이 Markdown 이면 결과도 Markdown 이어야 한다 — 감싸지 않는다.
//
// 구조화된 값(경로·첨부·실패)은 짧은 머리말로 남기고, 본문은 그 아래에 그대로 붙인다.

import type { ConfluencePageResult, ConfluenceSearchResult } from './connector'

export function renderSearchResult(data: unknown): string {
  const result = data as Partial<ConfluenceSearchResult> | null | undefined
  const hits = Array.isArray(result?.hits) ? result.hits : []
  const pages = Array.isArray(result?.pages) ? result.pages : []
  const failed = Array.isArray(result?.failedPages) ? result.failedPages : []
  const skipped = typeof result?.skippedPages === 'number' ? result.skippedPages : 0

  if (hits.length === 0) return '검색 결과가 없습니다.'

  const lines: string[] = [
    `검색 결과 ${hits.length}건 중 ${pages.length}건의 본문을 Markdown 으로 변환했습니다.`
  ]
  if (skipped > 0) {
    lines.push(
      `상한을 넘어 본문을 펼치지 않은 페이지 ${skipped}건 — 질의를 좁히거나 maxPages 를 올리세요.`
    )
  }
  if (failed.length > 0) {
    lines.push(
      `본문을 가져오지 못한 페이지 ${failed.length}건: ` +
        failed.map((item) => `${item.title || item.pageId}(${item.message})`).join(', ')
    )
  }

  // 변환하지 않은 hit 도 id·제목은 남긴다 — 다음 질의의 재료다.
  const expanded = new Set(pages.map((page) => page.pageId))
  const rest = hits.filter((hit) => !expanded.has(hit.id))
  if (rest.length > 0) {
    lines.push('', '## 본문을 펼치지 않은 검색 결과')
    for (const hit of rest) {
      lines.push(
        `- ${hit.title} (pageId: ${hit.id}${hit.spaceKey ? `, space: ${hit.spaceKey}` : ''})`
      )
    }
  }

  for (const page of pages) lines.push('', ...renderPage(page))
  return lines.join('\n')
}

function renderPage(page: ConfluencePageResult): string[] {
  const head = [`## ${page.title} (pageId: ${page.pageId}${space(page)})`]
  head.push(`- Markdown 파일: ${page.markdownPath}`)

  const assets = Array.isArray(page.assets) ? page.assets : []
  if (assets.length > 0) {
    // 본문의 이미지 경로가 `assets/<파일명>` 이라 디렉터리를 함께 줘야 모델이 실제 파일에 닿는다.
    head.push(
      `- 내려받은 첨부 ${assets.length}개 (${page.directory}): ${assets.map((a) => a.filename).join(', ')}`
    )
  }
  const failedAssets = Array.isArray(page.failedAssets) ? page.failedAssets : []
  if (failedAssets.length > 0) {
    head.push(
      `- 받지 못한 첨부: ${failedAssets.map((a) => `${a.filename}(${a.message})`).join(', ')}`
    )
  }
  const macros = Array.isArray(page.unhandledMacros) ? page.unhandledMacros : []
  if (macros.length > 0) {
    // 조용한 내용 소실을 만들지 않는다 — 무엇이 폴백됐는지 모델이 알아야 한다.
    head.push(`- 전용 변환이 없어 인용블록으로 남긴 매크로: ${macros.join(', ')}`)
  }
  if (page.previewTruncated) {
    head.push(`- 아래 본문은 앞부분만입니다. 전체는 ${page.markdownPath} 에 있습니다.`)
  }

  return [...head, '', page.markdownPreview ?? '']
}

function space(page: ConfluencePageResult): string {
  return page.spaceKey === undefined ? '' : `, space: ${page.spaceKey}`
}
