import { describe, expect, it } from 'vitest'
import {
  HTML_BODY_INPUT_LIMIT,
  HTML_CHARSET_SNIFF_BYTES,
  decodeHtmlBytes,
  htmlToBodyText
} from './html-body'

// 0302 EP-02 — 변환 규칙마다 고유 표지 하나. 규칙 하나를 지우면 그 표지만 달라진다.
describe('htmlToBodyText (0302 AC3·AC5)', () => {
  it.each(['style', 'script', 'noscript', 'head', 'title'] as const)(
    'drops <%s> text but keeps the visible body',
    (tag) => {
      const marker = `${tag.toUpperCase()}MARK`
      // `head` 는 HTML 파서가 메타데이터 요소만 남긴다(맨 텍스트는 body 로 옮겨진다) — 그 안에서
      // 텍스트를 가질 수 있는 요소는 title·style·script·noscript·template 뿐이다.
      const html =
        tag === 'title'
          ? `<html><head><title>${marker}</title></head><body><p>VISIBLEBODY</p></body></html>`
          : tag === 'head'
            ? `<html><head><template>${marker}</template></head><body><p>VISIBLEBODY</p></body></html>`
            : `<html><body><${tag}>${marker}</${tag}><p>VISIBLEBODY</p></body></html>`
      const text = htmlToBodyText(html)
      expect(text).toContain('VISIBLEBODY')
      expect(text).not.toContain(marker)
    }
  )

  it('keeps markdown-significant characters unescaped for search', () => {
    expect(htmlToBodyText('<p>snake_case_word *star* [x]</p>')).toBe('snake_case_word *star* [x]')
  })

  it('drops image alt and src', () => {
    const text = htmlToBodyText('<p>BEFOREIMG<img alt="IMGALT" src="cid:IMGSRC">AFTERIMG</p>')
    expect(text).toContain('BEFOREIMG')
    expect(text).toContain('AFTERIMG')
    expect(text).not.toContain('IMGALT')
    expect(text).not.toContain('IMGSRC')
  })

  it('keeps link text and drops the href', () => {
    const text = htmlToBodyText('<p><a href="http://HREFMARK/x">LINKTEXT</a></p>')
    expect(text).toContain('LINKTEXT')
    expect(text).not.toContain('HREFMARK')
  })

  it('returns an empty string for whitespace-only HTML and trims the result', () => {
    expect(htmlToBodyText('<html><body><p> </p></body></html>')).toBe('')
    expect(htmlToBodyText('<p>   TRIMMED   </p>')).toBe('TRIMMED')
    // turndown 은 앞쪽 nbsp·줄바꿈을 남긴다 — trim 은 여기서 한다.
    expect(htmlToBodyText('&nbsp;LEADNBSP&nbsp;')).toBe('LEADNBSP')
    expect(htmlToBodyText('<br><br>LEADBR<br>')).toBe('LEADBR')
    expect(htmlToBodyText('<p>&nbsp;</p>')).toBe('')
  })

  it('reuses one service: repeated conversions are identical', () => {
    const html = '<style>.a{}</style><p>REPEAT_ONE <a href="http://h">L</a></p>'
    expect(htmlToBodyText(html)).toBe(htmlToBodyText(html))
    expect(htmlToBodyText(html)).toBe('REPEAT_ONE L')
  })

  it('converts only the first HTML_BODY_INPUT_LIMIT code units', () => {
    // 값 자체가 계약이다 (0302 D-003 · D-015).
    expect(HTML_BODY_INPUT_LIMIT).toBe(131_072)
    expect(HTML_CHARSET_SNIFF_BYTES).toBe(1024)
    const before = '<p>MARKERA</p>'
    const after = '<p>MARKERB</p>'
    const filler = 'x'.repeat(HTML_BODY_INPUT_LIMIT - before.length - 1)
    const over = `${before}${filler} ${after}`
    expect(over.indexOf('MARKERB')).toBeGreaterThan(HTML_BODY_INPUT_LIMIT)
    const cut = htmlToBodyText(over)
    expect(cut).toContain('MARKERA')
    expect(cut).not.toContain('MARKERB')

    const exact = `${before}${'x'.repeat(HTML_BODY_INPUT_LIMIT - before.length - after.length)}${after}`
    expect(exact.length).toBe(HTML_BODY_INPUT_LIMIT)
    expect(htmlToBodyText(exact)).toContain('MARKERB')
  })
})

const EUC_KR_MEETING = Buffer.from([0xc8, 0xb8, 0xc0, 0xc7]) // '회의'

function html(head: string, body: Buffer | string): Buffer {
  return Buffer.concat([
    Buffer.from(`<html><head>${head}</head><body><p>`),
    typeof body === 'string' ? Buffer.from(body, 'utf8') : body,
    Buffer.from('</p></body></html>')
  ])
}

// 0302 EP-06 분기 (a)~(f).
describe('decodeHtmlBytes (0302 AC17)', () => {
  it('(a) honours <meta charset> for EUC-KR bytes', () => {
    expect(decodeHtmlBytes(html('<meta charset="euc-kr">', EUC_KR_MEETING))).toContain('회의')
  })

  it('(b) honours the http-equiv Content-Type form', () => {
    const head = '<meta http-equiv="Content-Type" content="text/html; charset=euc-kr">'
    expect(decodeHtmlBytes(html(head, EUC_KR_MEETING))).toContain('회의')
  })

  // 선언 단계만이 내는 결과 — 선언이 없으면 같은 바이트가 UTF-8 `é` 가 된다.
  it.each([
    ['(a) charset attribute', '<meta charset="iso-8859-1">'],
    [
      '(b) http-equiv content',
      '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">'
    ]
  ])('%s declaration wins over the UTF-8 fallback', (_name, head) => {
    expect(decodeHtmlBytes(html(head, Buffer.from([0xc3, 0xa9])))).toContain('Ã©')
  })

  it('(c) falls back to UTF-8 when the declared label is unknown', () => {
    expect(decodeHtmlBytes(html('<meta charset="bogus">', '결재'))).toContain('결재')
  })

  it('(d) decodes undeclared valid UTF-8 as UTF-8', () => {
    expect(decodeHtmlBytes(html('', '결재'))).toContain('결재')
  })

  it('(e) decodes undeclared invalid UTF-8 as EUC-KR', () => {
    expect(decodeHtmlBytes(html('', EUC_KR_MEETING))).toContain('회의')
  })

  it('(f) only sniffs the declaration inside the first HTML_CHARSET_SNIFF_BYTES bytes', () => {
    const latinMeta = '<meta charset="iso-8859-1">'
    const eAcute = Buffer.from([0xc3, 0xa9])
    const inside = html(latinMeta, eAcute)
    expect(decodeHtmlBytes(inside)).toContain('Ã©')
    const pad = `<meta name="pad" content="${'p'.repeat(HTML_CHARSET_SNIFF_BYTES)}">`
    const outside = html(`${pad}${latinMeta}`, eAcute)
    expect(outside.indexOf('charset')).toBeGreaterThan(HTML_CHARSET_SNIFF_BYTES)
    expect(decodeHtmlBytes(outside)).toContain('é')
    expect(decodeHtmlBytes(outside)).not.toContain('Ã©')
  })
})

// 0302 ΔV2 EP-06″ — charset 탐지 창과 디코딩 입력 길이를 구분한다.
describe('decodeHtmlBytes (0302 AC18)', () => {
  it.each([
    ['(g1) declared EUC-KR', '<meta charset="euc-kr">', Buffer.from('b0e1b7d0', 'hex')],
    ['(g2) undeclared UTF-8', '', Buffer.from('결론', 'utf8')],
    ['(g3) undeclared EUC-KR fallback', '', Buffer.from('b0e1b7d0', 'hex')]
  ])('decodes the entire input through %s', (_path, declaration, marker) => {
    const filler = `<p>${'f'.repeat(4 * HTML_CHARSET_SNIFF_BYTES)}</p>`
    // 표지는 마지막 바이트들이다. 전체 결과를 비교해 앞·뒤·중간 누락을 모두 잡는다.
    const bytes = Buffer.concat([Buffer.from(`${declaration}${filler}`, 'ascii'), marker])
    expect(bytes.byteLength).toBeGreaterThan(4 * HTML_CHARSET_SNIFF_BYTES)
    expect(decodeHtmlBytes(bytes)).toBe(`${declaration}${filler}결론`)
  })
})
