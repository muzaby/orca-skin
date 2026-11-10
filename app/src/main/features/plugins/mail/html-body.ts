// 메일 HTML → 검색용 본문 텍스트 (0302) — **순수 함수만**. 네트워크·fs·DB 의존 0.
//
// 결과는 FTS(trigram) 색인과 300자 snippet 이 소비한다. 그래서 turndown 기본 설정을 쓰지 않는다:
//   - `<style>`·`<script>` 텍스트가 본문에 섞이고(`T.a{color:red}var x=1`),
//   - `escape` 가 `file_name` 을 `file\_name` 으로 바꿔 원문 단어 검색이 깨지고,
//   - 링크·이미지가 `[Click](http://…)![logo](cid:…)` 로 남아 snippet 을 URL 이 채운다.
// turndown 은 입력 크기에 초선형이다(실측 `<p>` 512KB 2.4s · 표 4MB 66s). 변환은 Electron main
// 스레드에서 돌므로 입력을 `HTML_BODY_INPUT_LIMIT` 로 자른다 (D-003).

import TurndownService from 'turndown'

// UTF-16 code unit 기준 변환 입력 상한. 이 뒤의 본문은 색인되지 않는다 (0302 D-003).
export const HTML_BODY_INPUT_LIMIT = 131_072

// HTML 첨부의 charset 선언을 찾는 바이트 창 (D-015).
export const HTML_CHARSET_SNIFF_BYTES = 1024

// 서비스는 규칙만 들고 있고 `turndown()` 은 호출마다 트리를 새로 만든다 — 메일마다 규칙을
// 다시 등록하지 않는다.
let turndownSingleton: TurndownService | null = null

function turndownService(): TurndownService {
  turndownSingleton ??= createTurndown()
  return turndownSingleton
}

function createTurndown(): TurndownService {
  const service = new TurndownService()
  service.remove(['style', 'script', 'noscript', 'head', 'title'])
  // 원문 단어를 그대로 색인한다 — 마크다운 이스케이프는 검색어와 어긋난다.
  service.escape = (text: string): string => text
  service.addRule('mail-image', { filter: 'img', replacement: () => '' })
  service.addRule('mail-link', { filter: 'a', replacement: (content) => content })
  return service
}

export function htmlToBodyText(html: string): string {
  return turndownService().turndown(html.slice(0, HTML_BODY_INPUT_LIMIT)).trim()
}

// postal-mime 는 첨부의 charset 파라미터를 버리고 원 바이트만 준다. 선언(`<meta>`) → UTF-8 →
// EUC-KR 순으로 읽는다 — 폐쇄망 한국어 메일의 EUC-KR 이 마지막 후보다 (D-015).
const META_CHARSET = /<meta\b[^>]*?charset\s*=\s*["']?\s*([A-Za-z0-9_.:-]+)/i

export function decodeHtmlBytes(bytes: Uint8Array): string {
  const head = Buffer.from(bytes.subarray(0, HTML_CHARSET_SNIFF_BYTES)).toString('latin1')
  const declared = head.match(META_CHARSET)?.[1]
  if (declared) {
    let decoder: TextDecoder | undefined
    try {
      decoder = new TextDecoder(declared)
    } catch {
      decoder = undefined
    }
    if (decoder) return decoder.decode(bytes)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('euc-kr').decode(bytes)
  }
}
