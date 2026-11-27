import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const file = 'src/renderer/src/features/chat/lib/transcript/viewEqual.ts'
const { deepEqual } = await import(pathToFileURL(resolve(file)))
const key = Object.freeze({ id: 'child' })
const cases = [
  ['same scalar', NaN, NaN, true],
  ['signed zero', -0, 0, false],
  ['type', {}, 1, false],
  ['left null', null, {}, false],
  ['right null', {}, null, false],
  ['unequal scalars', 'aa', 'bb', false],
  ['array kind', [], {}, false],
  ['array-like record', [], { length: 0 }, false],
  ['array length', [], [1], false],
  ['array items', ['a', 'b'], ['b', 'a'], false],
  ['equal nested arrays', [{ a: [1] }], [{ a: [1] }], true],
  ['map kind', new Map(), {}, false],
  ['map size', new Map(), new Map([[1, 2]]), false],
  ['map keys', new Map([['a', undefined]]), new Map([['b', undefined]]), false],
  ['map values', new Map([[key, [1]]]), new Map([[key, [2]]]), false],
  ['equal maps', new Map([[key, 1], ['b', 2]]), new Map([['b', 2], [key, 1]]), true],
  ['record array', {}, [], false],
  ['record map', {}, new Map(), false],
  ['record size', {}, { x: undefined }, false],
  ['record keys', { a: undefined }, { b: undefined }, false],
  ['own keys', { toString: Object.prototype.toString }, { other: 1 }, false],
  ['record values', { a: 1, b: 2 }, { a: 2, b: 1 }, false],
  ['equal records', { a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }, true]
]
for (const [name, left, right, expected] of cases) {
  test(name, () => {
    assert.equal(deepEqual(left, right), expected)
    assert.equal(deepEqual(right, left), expected)
  })
}
