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
  return service
}

export function storageToMarkdown(storageXhtml: string): StorageConversion {
  const referenced = new Set<string>()
  const unhandled = new Set<string>()

  // xmlMode 가 핵심이다 — 위 헤더 주석 1번 참조.
  const $ = cheerio.load(storageXhtml, { xmlMode: true })

  normalizeImages($, referenced)
  normalizeLinks($)
  normalizeMacros($, unhandled)

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
