import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const file = 'src/renderer/src/shared/ui/markdown/sourceParts.ts'
const { markSourceText, sliceSourceParts } = await import(
  pathToFileURL(resolve(file))
)
test('assigns every character of the rendered fence to the owning source part', () => {
  const opening = '  ~~~~example\r\n'
  const body = ' \txy\r\n  zz\r\nqq'
  const source = opening + body
  const labels = [
    'before',
    'tab',
    'x',
    'y',
    'cr',
    'lf',
    'indent1',
    'indent2',
    'z1',
    'z2',
    'cr2',
    'lf2',
    'q1',
    'q2',
  ]
  const parts = [
    { start: 0, key: 'prefix' },
    ...[...body].map((_, i) => ({ start: opening.length + i, key: labels[i] })),
  ]
  const expected = [
    ['tab', '  '],
    ['x', 'x'],
    ['y', 'y'],
    ['cr', '\n'],
    ['z1', 'z'],
    ['z2', 'z'],
    ['cr2', '\n'],
    ['q1', 'q'],
    ['q2', 'q'],
  ]
  assert.deepEqual(
    markSourceText(
      '  xy\nzz\nqq',
      source,
      opening.length,
      source.length,
      parts,
      { fenceIndent: 2 },
    ),
    expected.map(([key, text]) => ({ key, text })),
  )
  assert.deepEqual(
    sliceSourceParts(parts, opening.length + 3, opening.length + 6),
    [
      { key: 'y', start: 0 },
      { key: 'cr', start: 1 },
      { key: 'lf', start: 2 },
    ],
  )
})
test('keeps prose and inline code offsets distinct from indented fences', () => {
  for (const [source, value, mode, expected] of [
    [
      'x&NotEqualTilde;y',
      'x≂̸y',
      'markdown',
      [
        ['k0', 'x'],
        ['k1', '≂̸'],
        ['k16', 'y'],
      ],
    ],
    [
      'x&amp;y',
      'x&y',
      'markdown',
      [
        ['k0', 'x'],
        ['k1', '&'],
        ['k6', 'y'],
      ],
    ],
    [
      '` x\r\ny `',
      'x y',
      'inlineCode',
      [
        ['k2', 'x'],
        ['k3', ' '],
        ['k5', 'y'],
      ],
    ],
    [
      'xx\nxy',
      'xx\nxy',
      { fenceIndent: 0 },
      [...'xx\nxy'].map((c, i) => ['k' + i, c]),
    ],
  ]) {
    const parts = [...source].map((_, i) => ({ key: 'k' + i, start: i }))
    assert.deepEqual(
      markSourceText(value, source, 0, source.length, parts, mode),
      expected.map(([key, text]) => ({ key, text })),
    )
  }
})
