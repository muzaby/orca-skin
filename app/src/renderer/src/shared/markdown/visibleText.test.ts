import { describe, expect, it } from 'vitest'
import { hasVisibleChar, hasVisibleText } from './visibleText'

// 0331 D-034 ① — 규칙 칸 4분기(공백·Cf / 공백 엔티티 / 링크 정의 / 그 밖)와 대조 입력.
describe('hasVisibleText (0331 D-034 ①)', () => {
  it.each([
    ['empty', ''],
    ['whitespace', ' \n\t\r\n'],
    ['zero-width space', '\u200b'],
    ['word joiner and BOM', '\u2060\ufeff'],
    ['soft hyphen', '\u00ad'],
    ['zero-width joiner', '\u200d'],
    ['nbsp entity', '&nbsp;'],
    ['numeric nbsp entities', '&#160; &#xA0;\n&#x00a0;'],
    ['zero-width entities', '&ZeroWidthSpace;&#8203;&#x200B;&zwnj;&zwj;&lrm;&rlm;'],
    ['space entities', '&ensp;&emsp;&thinsp;'],
    ['link definition', '[ref]: https://example.com'],
    [
      'indented definitions with titles',
      '   [a]: <https://x.test> "title"\n[b]: /y \'t\'\n[c]: z (t)\r'
    ],
    ['definition plus blank entity', '[ref]: https://example.com\n&nbsp;\n\u200b']
  ])('treats %s as invisible', (_, text) => {
    expect(hasVisibleText(text)).toBe(false)
  })

  it.each([
    ['plain note', 'visible note'],
    ['entity inside inline code', '`&nbsp;`'],
    ['ampersand entity', '&amp;'],
    ['definition followed by text', '[ref]: https://example.com\ntext'],
    ['emoji', '👍'],
    ['visible char next to zero-width space', 'a\u200b'],
    ['footnote definition', '[^1]: footnote'],
    ['unknown entity', '&#x2002;'],
    ['case-mismatched entity', '&NBSP;'],
    ['definition without destination', '[ref]:'],
    ['definition title on the next line', '[ref]: https://example.com\n"title"']
  ])('treats %s as visible', (_, text) => {
    expect(hasVisibleText(text)).toBe(true)
  })
})

describe('hasVisibleChar (0331 D-034 ②)', () => {
  it.each([
    ['', false],
    ['  \n', false],
    ['\u200b\u2060\ufeff\u00ad', false],
    ['&nbsp;', true],
    ['a\u200b', true]
  ])('%j → %s', (text, expected) => {
    expect(hasVisibleChar(text)).toBe(expected)
  })
})
