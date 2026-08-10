// 도구 결과 → 모델에게 줄 **텍스트** (0164 r2, r3 에서 2종으로 분리) — 순수 함수.
//
// 이 파일이 생긴 이유는 하나다: 이전 구현이 `JSON.stringify(result.data, null, 2)` 를 그대로
// 실었다. Markdown 이 JSON 문자열 **안에** 들어가면 줄바꿈이 `\n` 두 글자로 이스케이프되어
// 모델에게도 사람에게도 한 줄로 보인다(사용자 보고 2026-08-04 "\n 기호를 줄바꿈으로 표시해서
// 그런듯"). 본문이 Markdown 이면 결과도 Markdown 이어야 한다 — 감싸지 않는다.

import type {
  ConfluencePageResult,
  ConfluencePagesResult,
  ConfluenceSearchResult
} from './connector'

// `confluence_search` — id·제목·작성자만. 본문은 `confluence_get_pages` 가 준다.
export function renderSearchResult(data: unknown): string {
  const result = data as Partial<ConfluenceSearchResult> | null | undefined
  const hits = Array.isArray(result?.hits) ? result.hits : []
  const start = typeof result?.start === 'number' ? result.start : 0
  const limit = typeof result?.limit === 'number' ? result.limit : hits.length
  const totalSize = typeof result?.totalSize === 'number' ? result.totalSize : undefined
  const nextStart = typeof result?.nextStart === 'number' ? result.nextStart : undefined

  if (hits.length === 0) {
    return start > 0 ? `offset ${start} 이후로는 결과가 없습니다.` : '검색 결과가 없습니다.'
  }

  // 범위를 명시한다 — 모델이 "몇 번째부터 몇 개를 봤는지" 알아야 다음 호출을 정할 수 있다.
  const range = `${start + 1}–${start + hits.length}`
  const of = totalSize !== undefined ? ` / 전체 ${totalSize}건` : ''
  const lines = [`검색 결과 ${range}${of} (한 번에 최대 ${limit}건)`]

  if (nextStart !== undefined) {
    // 다음 오프셋을 **계산해서** 준다. 모델이 limit 을 더해 만들게 하면 서버가 limit 을 낮춘
    // 경우 결과를 건너뛴다.
    lines.push(`더 있습니다 — 다음 호출에 start: ${nextStart} 를 넣으세요.`)
  }

  lines.push('', '본문이 필요하면 아래 pageId 들을 confluence_get_pages 에 넘기세요.', '')
  for (const hit of hits) lines.push(`- ${hitLine(hit)}`)
  return lines.join('\n')
}

function hitLine(hit: ConfluenceSearchResult['hits'][number]): string {
  const meta = [`pageId: ${hit.id}`]
  if (hit.author !== undefined) meta.push(`작성자: ${hit.author}`)
  if (hit.spaceKey !== undefined) meta.push(`space: ${hit.spaceKey}`)
  return `${hit.title} (${meta.join(', ')})`
}

// `confluence_get_pages` — 본문 Markdown + 내려받은 첨부.
export function renderPagesResult(data: unknown): string {
  const result = data as Partial<ConfluencePagesResult> | null | undefined
  const pages = Array.isArray(result?.pages) ? result.pages : []
  const failed = Array.isArray(result?.failedPages) ? result.failedPages : []
  const skipped = Array.isArray(result?.skippedPageIds) ? result.skippedPageIds : []

  const lines: string[] = [`${pages.length}건의 본문을 Markdown 으로 변환했습니다.`]
  if (failed.length > 0) {
    lines.push(
      `가져오지 못한 페이지 ${failed.length}건: ` +
        failed.map((item) => `${item.pageId}(${item.message})`).join(', ')
    )
  }
  if (skipped.length > 0) {
    // 조용히 버리지 않는다 — 남은 id 를 그대로 줘서 다음 호출로 이어갈 수 있게 한다.
    lines.push(`상한을 넘어 처리하지 않은 pageId ${skipped.length}건: ${skipped.join(', ')}`)
  }
  if (pages.length === 0) return lines.join('\n')

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
  // 받은 것이 0인데 페이지에 첨부가 있다 = 본문에서 이미지 참조를 못 찾았다는 신호다 (0168).
  // "첨부 없는 페이지" 와 구분되지 않으면 검출 실패가 무성으로 묻힌다.
  const unreferenced = Array.isArray(page.unreferencedAttachments)
    ? page.unreferencedAttachments
    : []
  if (unreferenced.length > 0) {
    const names = nameList(unreferenced)
    head.push(
      assets.length === 0
        ? `- 본문에서 이미지 참조를 찾지 못했습니다. 이 페이지에 딸린 첨부 ${unreferenced.length}개(받지 않음): ${names}`
        : `- 본문이 참조하지 않아 받지 않은 첨부 ${unreferenced.length}개: ${names}`
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

// 진단 목록에 실을 이름 수 상한 (0168 verify r1 D1). 첨부 목록은 페이지당 200건까지 오고
// `get_pages` 는 한 번에 50페이지를 받는다 — 상한이 없으면 최악 10,000개 파일명이 모델
// 컨텍스트로 들어간다. 본문 미리보기를 `PREVIEW_CHARS` 로 자르는 것과 같은 이유다.
// **전량은 `manifest.json` 에 남는다** — 디스크는 컨텍스트 비용이 없다.
const MAX_DIAGNOSTIC_NAMES = 20

function nameList(names: readonly string[]): string {
  if (names.length <= MAX_DIAGNOSTIC_NAMES) return names.join(', ')
  // 잘렸다는 사실과 남은 수를 함께 준다 — 모델이 목록을 완전한 것으로 읽지 않게.
  const shown = names.slice(0, MAX_DIAGNOSTIC_NAMES).join(', ')
  return `${shown} … 외 ${names.length - MAX_DIAGNOSTIC_NAMES}개 (전체 목록은 manifest.json)`
}

function space(page: ConfluencePageResult): string {
  return page.spaceKey === undefined ? '' : `, space: ${page.spaceKey}`
}
