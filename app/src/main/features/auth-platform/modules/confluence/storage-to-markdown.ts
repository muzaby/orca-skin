// Confluence storage(XHTML) → Markdown 변환 (0160) — **순수 함수만**. 네트워크·fs 의존 0.
//
// 이 모듈이 이번 작업의 존재 이유다. `@atlassian-dc-mcp/confluence` 는 storage XHTML 을 그대로
// 돌려주는데, 그 형식은 `ac:`/`ri:` 네임스페이스 태그로 가득해 모델이 읽기에 나쁘고 토큰도
// 크다(사용자: "기능이 부족하여 api 호출후 추가적인 변환과정을 처리하여 반환하는 것이 목적").
//
// 두 가지 규칙이 결과를 좌우한다:
//   1. **cheerio 는 반드시 `xmlMode`.** HTML 파서로 읽으면 `<ac:structured-macro>` 가 알 수 없는
//      태그로 뭉개지고 self-closing `<ri:attachment/>` 가 컨테이너로 잘못 해석된다.
//   2. **매크로 전처리를 turndown 보다 먼저.** turndown 은 표준 HTML 만 안다. 전처리 없이
//      넘기면 매크로 본문이 통째로 사라진다 — 조용한 내용 소실이 가장 나쁜 결과다.

import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { ASSETS_DIR, sanitizeAssetName } from './download-store'

export interface StorageConversion {
  markdown: string
  // 본문이 실제로 참조하는 첨부 파일 이름(정규화 전 원본 이름). 이 집합만 내려받는다 —
  // 페이지에 딸린 첨부 전부를 받으면 쓰지 않는 파일까지 디스크에 쌓인다.
  referencedAttachments: string[]
  // 전용 처리가 없어 폴백된 매크로 이름. 조용히 사라지지 않았음을 호출자가 기록한다.
  unhandledMacros: string[]
}

// 전용 변환이 있는 매크로. 나머지는 이름이 보이는 인용블록으로 폴백한다.
const ADMONITION_MACROS = new Set(['info', 'note', 'warning', 'tip'])

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_'
  })
  // 표·취소선·작업목록·자동링크. Confluence 페이지는 표가 많아 이게 없으면 본문이 뭉개진다.
  service.use(gfm)

  // 셀 안의 줄바꿈은 리터럴 `<br>` 로 남긴다. turndown 기본 br 규칙은 `"  \n"` (하드 랩) 이라
  // GFM 표 안에서는 **행을 끊어** 표 전체가 깨진다. gfm 뒤에 등록해야 우선한다
  // (turndown `addRule` 은 unshift — 나중 등록이 먼저 매칭된다).
  service.addRule('tableCellBreak', {
    filter: (node) => node.nodeName === 'BR' && isInsideTableCell(node),
    replacement: () => '<br>'
  })
  return service
}

function isInsideTableCell(node: { parentNode: unknown }): boolean {
  let current = node.parentNode as { nodeName?: string; parentNode?: unknown } | null
  while (current !== null && current !== undefined) {
    if (current.nodeName === 'TD' || current.nodeName === 'TH') return true
    if (current.nodeName === 'TABLE') return false
    current = (current.parentNode ?? null) as { nodeName?: string; parentNode?: unknown } | null
  }
  return false
}

export function storageToMarkdown(storageXhtml: string): StorageConversion {
  const referenced = new Set<string>()
  const unhandled = new Set<string>()

  // xmlMode 가 핵심이다 — 위 헤더 주석 1번 참조.
  const $ = cheerio.load(storageXhtml, { xmlMode: true })

  normalizeImages($, referenced)
  normalizeLinks($)
  normalizeMacros($, unhandled)
  normalizeTables($)

  const html = $.root().html() ?? ''
  const markdown = createTurndown().turndown(html).trim()

  return {
    markdown,
    referencedAttachments: [...referenced],
    unhandledMacros: [...unhandled]
  }
}

// `<ac:image><ri:attachment ri:filename="x.png"/></ac:image>` → `<img src="assets/x.png">`
// 첨부가 아닌 외부 URL 이미지는 그대로 두고 다운로드 대상에 넣지 않는다.
function normalizeImages($: cheerio.CheerioAPI, referenced: Set<string>): void {
  $('ac\\:image').each((_, element) => {
    const node = $(element)
    const alt = node.attr('ac:alt') ?? node.attr('ac:title') ?? ''

    const attachment = node.find('ri\\:attachment').first()
    const filename = attachment.attr('ri:filename')
    if (filename !== undefined && filename !== '') {
      referenced.add(filename)
      node.replaceWith(imgTag(`${ASSETS_DIR}/${sanitizeAssetName(filename)}`, alt || filename))
      return
    }

    const url = node.find('ri\\:url').first().attr('ri:value')
    if (url !== undefined && url !== '') {
      node.replaceWith(imgTag(url, alt))
      return
    }

    // 참조가 없는 이미지 매크로 — 흔적을 남기고 지운다.
    node.replaceWith('<p>[image]</p>')
  })
}

function imgTag(src: string, alt: string): string {
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`
}

// `<ac:link><ri:page ri:content-title="제목"/><ac:plain-text-link-body>텍스트</...></ac:link>`
// 내부 링크는 URL 을 만들 수 없으므로(공간 키·baseUrl 이 본문에 없다) 제목 텍스트로 남긴다.
function normalizeLinks($: cheerio.CheerioAPI): void {
  $('ac\\:link').each((_, element) => {
    const node = $(element)
    const title =
      node.find('ri\\:page').first().attr('ri:content-title') ??
      node.find('ri\\:attachment').first().attr('ri:filename') ??
      ''
    const bodyText = node.find('ac\\:plain-text-link-body, ac\\:link-body').first().text().trim()
    const label = bodyText !== '' ? bodyText : title
    node.replaceWith(label !== '' ? `<span>${escapeText(label)}</span>` : '')
  })
}

function normalizeMacros($: cheerio.CheerioAPI, unhandled: Set<string>): void {
  $('ac\\:structured-macro').each((_, element) => {
    const node = $(element)
    const name = node.attr('ac:name') ?? 'unknown'

    if (name === 'code') {
      const language = parameterValue($, node, 'language')
      const body = node.find('ac\\:plain-text-body').first().text()
      const attr = language !== '' ? ` class="language-${escapeAttr(language)}"` : ''
      node.replaceWith(`<pre><code${attr}>${escapeText(body)}</code></pre>`)
      return
    }

    if (ADMONITION_MACROS.has(name)) {
      const body = node.find('ac\\:rich-text-body').first().html() ?? ''
      node.replaceWith(
        `<blockquote><p><strong>${name.toUpperCase()}</strong></p>${body}</blockquote>`
      )
      return
    }

    // 전용 처리가 없는 매크로. **지우지 않는다** — 매크로 이름과 안에 있던 텍스트를 남겨
    // 무엇이 빠졌는지 사람이 알 수 있게 한다. 이름은 manifest 에 집계된다.
    unhandled.add(name)
    const inner = node.find('ac\\:rich-text-body').first().html()
    const plain = node.find('ac\\:plain-text-body').first().text()
    const fallbackBody =
      inner !== null && inner !== undefined && inner !== ''
        ? inner
        : plain !== ''
          ? `<p>${escapeText(plain)}</p>`
          : ''
    // 대괄호를 쓰지 않는다 — turndown 이 링크 문법과 헷갈리지 않게 `\[` 로 이스케이프해
    // 결과가 `\[macro: jira\]` 로 지저분해진다(실측).
    node.replaceWith(
      `<blockquote><p><strong>macro: ${escapeText(name)}</strong></p>${fallbackBody}</blockquote>`
    )
  })

  // 남은 본문 컨테이너는 내용으로 펼친다(태그 자체는 의미가 없다).
  $(
    'ac\\:rich-text-body, ac\\:plain-text-body, ac\\:layout, ac\\:layout-section, ac\\:layout-cell'
  ).each((_, element) => {
    const node = $(element)
    node.replaceWith(node.html() ?? '')
  })
}

// 표는 Confluence 저장 형식과 turndown-plugin-gfm 사이의 간극이 가장 큰 지점이다.
// gfm 의 `table` 규칙은 **머리글 행이 있는 표만** 변환하고, 아니면 `keep()` 으로 원본 HTML 을
// 그대로 뱉는다(`turndown-plugin-gfm/lib/turndown-plugin-gfm.cjs.js` — `rules.table` 의 필터가
// `isHeadingRow(node.rows[0])`, `tables()` 가 그 여집합을 `keep`). 그래서 실제 Confluence 표는
// Markdown 이 아니라 XML 로 새어 나온다(사용자 보고 2026-08-04 "table xml은 그대로 표시").
// `isHeadingRow` 가 요구하는 세 조건을 여기서 맞춰 준다.
function normalizeTables($: cheerio.CheerioAPI): void {
  // 1. `<colgroup>` 제거. `<tbody>` 앞에 오면 `isFirstTbody()` 가 previousSibling 때문에 false 가
  //    되어 머리글 판정이 통째로 실패한다. 열 너비 정보라 Markdown 에서 쓸 데도 없다.
  //    Confluence 는 표에 거의 항상 붙인다 — 이 한 줄이 없으면 대부분의 표가 깨진다.
  $('colgroup').remove()

  $('table').each((_, element) => {
    const table = $(element)
    flattenCellBlocks($, table)
    promoteHeaderRow($, table)
  })
}

// 2. 셀 안의 블록(`<p>`)을 편다. Confluence 는 셀 내용을 항상 `<p>` 로 감싸는데, 문단이 둘 이상인
//    셀은 turndown 이 셀 한가운데에 빈 줄을 넣어 행을 끊는다. 문단 경계는 `<br>` 로 남긴다.
function flattenCellBlocks($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): void {
  table.find('td, th').each((_, element) => {
    const cell = $(element)
    const blocks = cell.find('p')
    if (blocks.length === 0) return
    blocks.each((index, block) => {
      const node = $(block)
      const inner = node.html() ?? ''
      node.replaceWith(index === blocks.length - 1 ? inner : `${inner}<br/>`)
    })
  })
}

// 3. 머리글 행이 없으면 첫 행을 머리글로 승격한다. GFM 표는 머리글이 필수라 승격하지 않으면
//    표 전체가 원본 HTML 로 남는다 — 첫 행의 의미가 조금 달라지는 쪽이 XML 노출보다 낫다.
//    `isHeadingRow` 는 **모든 셀이 `<th>`** 일 것을 요구하므로 섞인 행도 전부 바꾼다.
function promoteHeaderRow($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): void {
  const first = table.find('tr').first()
  if (first.length === 0) return
  // `<thead>` 안이면 turndown 이 이미 머리글로 인정한다 — 건드리지 않는다.
  if (first.parent().is('thead')) return

  const cells = first.children('td')
  if (cells.length === 0) return
  cells.each((_, element) => {
    const cell = $(element)
    const attrs = Object.entries(cell.attr() ?? {})
      .map(([name, value]) => ` ${name}="${escapeAttr(String(value))}"`)
      .join('')
    cell.replaceWith(`<th${attrs}>${cell.html() ?? ''}</th>`)
  })
}

function parameterValue(
  $: cheerio.CheerioAPI,
  macro: ReturnType<cheerio.CheerioAPI>,
  name: string
): string {
  const found = macro
    .find('ac\\:parameter')
    .filter((_, element) => $(element).attr('ac:name') === name)
    .first()
  return found.text().trim()
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
