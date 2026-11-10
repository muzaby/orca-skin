import { describe, expect, it } from 'vitest'
import {
  MAIL_GET_DEFAULT_CHARS,
  MAIL_GET_MAX_CHARS,
  MAIL_SEARCH_SNIPPET_CHARS,
  sliceBody
} from './body-window'

const body = Array.from({ length: 20_000 }, (_, i) => String.fromCharCode(33 + (i % 90))).join('')

describe('mail body windows', () => {
  it('uses the public defaults and returns distinct consecutive windows', () => {
    expect([MAIL_GET_DEFAULT_CHARS, MAIL_GET_MAX_CHARS, MAIL_SEARCH_SNIPPET_CHARS]).toEqual([
      8000, 16000, 300
    ])
    expect(sliceBody(body)).toEqual({
      offset: 0,
      returnedChars: 8000,
      text: body.slice(0, 8000),
      totalChars: 20000,
      nextOffset: 8000
    })
    const pages = [sliceBody(body), sliceBody(body, 8000), sliceBody(body, 16000)]
    expect(pages.map((p) => p.text).join('')).toBe(body)
    expect(pages[2]).toMatchObject({ returnedChars: 4000, nextOffset: null })
  })

  it.each([
    [37, 113],
    [8000, 8000],
    [19990, 5]
  ])('reads offset %i and maxChars %i', (offset, maxChars) => {
    expect(sliceBody(body, offset, maxChars)).toEqual({
      offset,
      returnedChars: maxChars,
      text: body.slice(offset, offset + maxChars),
      totalChars: 20000,
      nextOffset: offset + maxChars
    })
  })

  it('normalizes invalid values and caps oversized requests', () => {
    for (const size of [0, -3, 2.5, NaN, Infinity])
      expect(sliceBody(body, 0, size)).toEqual(sliceBody(body))
    for (const offset of [-5, 1.7, NaN, Infinity])
      expect(sliceBody(body, offset)).toEqual(sliceBody(body))
    expect(sliceBody(body, 0, 99999)).toMatchObject({ returnedChars: 16000, nextOffset: 16000 })
    for (const offset of [20000, 99999])
      expect(sliceBody(body, offset)).toEqual({
        offset,
        text: '',
        totalChars: 20000,
        returnedChars: 0,
        nextOffset: null
      })
    expect(sliceBody('')).toEqual({
      offset: 0,
      text: '',
      totalChars: 0,
      returnedChars: 0,
      nextOffset: null
    })
  })

  it.each([
    [0, 3, 0, 'ab', 2],
    [3, 2, 2, '😀', 4],
    [2, 1, 2, '😀', 4]
  ] as const)(
    'preserves code points at offset %i and size %i',
    (offset, size, actual, text, nextOffset) => {
      const page = sliceBody('ab😀cd', offset, size)
      expect(page).toEqual({
        offset: actual,
        returnedChars: text.length,
        text,
        totalChars: 6,
        nextOffset
      })
      expect(page.text).not.toMatch(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
      )
    }
  )
})
