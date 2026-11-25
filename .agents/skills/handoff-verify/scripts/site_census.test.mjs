// node --test .agents/skills/handoff-verify/scripts/site_census.test.mjs (저장소 루트에서)
// 분류가 바뀌면 §10 자리 목록의 미분류 판정이 조용히 달라지므로, 줄 종류마다 한 사례를 고정한다.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const script = '.agents/skills/handoff-verify/scripts/site_census.mjs'
const dir = mkdtempSync(join(tmpdir(), 'site-census-'))
const file = join(dir, 'fixture.tsx')
writeFileSync(
  file,
  [
    "import { boundary } from './x'", // 1 import
    'interface S { boundary: number }', // 2 type
    '// boundary moves with prepends', // 3 comment
    'function boundary2(): void {}', // 4 not a hit (different word)
    'const { a, boundary: b } = s', // 5 value (binding with property name)
    'const { boundary } = s', // 6 value (shorthand binding)
    'use({ boundary })', // 7 value (shorthand property)
    'deps([x, boundary])', // 8 value (identifier)
    'function boundary(): void {}', // 9 declaration
    'x.boundary = 1' // 10 value (write)
  ].join('\n')
)
const run = (...extra) => {
  try {
    return { code: 0, out: execFileSync('node', [script, '--search', `rg -n '\\bboundary\\b' ${dir}`, ...extra], { encoding: 'utf8' }) }
  } catch (error) {
    return { code: error.status, out: error.stdout }
  }
}
const classes = (out) =>
  Object.fromEntries(
    out
      .split('\n')
      .filter((row) => row.startsWith(file))
      .map((row) => [Number(row.split('\t')[0].split(':').pop()), row.split('\t')[1]])
  )

test('classifies each kind of hit line', () => {
  assert.deepEqual(classes(run().out), {
    1: 'import',
    2: 'type',
    3: 'comment',
    5: 'value',
    6: 'value',
    7: 'value',
    8: 'value',
    9: 'declaration',
    10: 'value'
  })
})

test('fails while a value line is neither a site nor excluded', () => {
  const partial = run('--sites', `${file}:5-8`)
  assert.equal(partial.code, 1)
  assert.match(partial.out, /미분류 1/)
  const closed = run('--sites', `${file}:5-8`, '--excluded', `${file}:10`)
  assert.equal(closed.code, 0)
  assert.match(closed.out, /미분류 0/)
})

test('emits one mutate.py spec per value occurrence that changes only that occurrence', () => {
  const specs = run('--emit-mutants', 'true')
    .out.split('\n')
    .filter((row) => row.startsWith('{'))
    .map((row) => JSON.parse(row))
  const byLine = Object.fromEntries(specs.map((s) => [s.id.split(':')[1], s.new]))
  assert.equal(byLine['6'], 'const { boundary__oo_mut: boundary } = s')
  assert.equal(byLine['7'], 'use({ boundary__oo_mut: boundary })')
  assert.equal(byLine['8'], 'deps([x, (void 0)])')
  assert.equal(byLine['10'], 'x.boundary__oo_mut = 1')
})
