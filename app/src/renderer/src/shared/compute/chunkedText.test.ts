import { expect, it } from 'vitest'
import { ChunkedText } from './chunkedText'

// 0331 D-034 ② — 65,536자를 넘는 글의 판정도 같은 글자 규칙을 쓴다.
it('D-034 hasContent ignores invisible characters', () => {
  const invisible = new ChunkedText()
  invisible.append('\u200b\u2060')
  invisible.append(' \n\ufeff')
  expect(invisible.hasContent).toBe(false)
  invisible.append('a\u200b')
  expect(invisible.hasContent).toBe(true)
})
