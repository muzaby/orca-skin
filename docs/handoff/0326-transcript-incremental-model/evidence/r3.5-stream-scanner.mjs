import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Resolve from the app being tested, including a temporary mutation checkout.
const moduleUrl = pathToFileURL(resolve('src/renderer/src/features/chat/lib/markdownBlocks.ts'))
const { advanceStableBlocks, openFenceTail } = await import(moduleUrl.href)

const cases = [
  { source: '', stable: [], tail: '' },
  {
    source: '\n\ntwo\n\nthree\n\nfour\n',
    stable: ['\n\ntwo', 'three'],
    tail: 'four\n'
  },
  {
    source: 'a\n\nb\n\nc\n\nd\n\ne\n',
    stable: ['a', 'b', 'c', 'd'],
    tail: 'e\n'
  },
  {
    source: '- list\n\n  continued\n\ndef\n',
    stable: ['- list\n\n  continued'],
    tail: 'def\n'
  },
  {
    source: 'p\n\n ~~~\n body\n',
    stable: ['p'],
    tail: ' ~~~\n body\n',
    code: 'body'
  },
  {
    source: ' ~~~js\r\n x\r\n ~~~\r\n\nanchor\n',
    stable: [' ~~~js\r\n x\r\n ~~~\r'],
    tail: 'anchor\n'
  },
  {
    source: '~~~\n' + 'z'.repeat(333),
    stable: [],
    tail: '~~~\n' + 'z'.repeat(333),
    code: 'z'.repeat(333)
  }
]
for (const { source, stable, tail, code } of cases) {
  test('scans and rewrites ' + JSON.stringify(source.slice(0, 32)), () => {
    for (const step of [1, 2, 7, source.length + 1]) {
      let result = advanceStableBlocks(null, '')
      for (let start = 0; start < source.length; start += step) {
        const next = source.slice(0, start + step)
        const previous = result.stable
        const previousValues = [...previous]
        result = advanceStableBlocks(result.cache, next)
        assert.deepEqual(previous, previousValues, 'older stable blocks remain unchanged')
        assert.equal(result.scanState.scannedChars, next.length)
      }
      assert.deepEqual(result.stable, stable)
      assert.equal(result.tail, tail)
      assert.equal(result.openFence?.code, code)
      const rewritten = advanceStableBlocks(result.cache, 'new\n\nlast\n')
      assert.deepEqual(rewritten.stable, ['new'])
      assert.equal(rewritten.tail, 'last\n')
      assert.equal(rewritten.scanState.scannedChars, 10)
    }
  })
}
test('standalone incomplete and short fences', () => {
  assert.equal(openFenceTail(' \n\n'), null)
  assert.equal(openFenceTail('  ~~~'), null)
  assert.equal(openFenceTail('~~~~\n~~~\nend').code, '~~~\nend')
})
test('caches blank runs only after a nonblank line', () => {
  const leading = advanceStableBlocks(null, '\n')
  assert.equal(leading.scanState.hasBlankAfterNonBlank, false)
  const body = advanceStableBlocks(leading.cache, '\nbody\n')
  assert.equal(body.scanState.hasBlankAfterNonBlank, false)
  assert.equal(advanceStableBlocks(body.cache, '\nbody\n\n').scanState.hasBlankAfterNonBlank, true)
})
test('preserves standalone and cached fence metadata and the consumed prefix', () => {
  const source = 'first\n\n  ~~~~c&#43;&#43; info\r\n  text\n~~~'
  const expected = { char: '~', length: 4, indent: 2, lang: 'c++', code: 'text\n~~~' }
  assert.deepEqual(openFenceTail('\n' + source.slice(7)), expected)
  assert.equal(openFenceTail('~~~a\nbody\n~~~'), null)
  assert.equal(openFenceTail('~~~  \nbody').lang, undefined)
  const partial = advanceStableBlocks(null, source.slice(0, -4))
  const complete = advanceStableBlocks(partial.cache, source)
  assert.deepEqual(complete.openFence, expected)
  assert.deepEqual(complete.stable, ['first'])
  assert.equal(complete.cache.consumed, 7)
  assert.equal(complete.cache.source.slice(complete.cache.consumed), complete.tail)
})
test('distinguishes adjacent text, fenced prelude and an unfinished closer', () => {
  const text = advanceStableBlocks(null, 'one\ntwo\nthree\n')
  assert.deepEqual(text.stable, [])
  assert.equal(text.tail, 'one\ntwo\nthree\n')
  assert.equal(advanceStableBlocks(null, 'prose\n~~~\ncode\n').openFence, null)
  assert.equal(advanceStableBlocks(null, '~~~\ncode\n~~~').openFence.code, 'code\n~~~')
})
