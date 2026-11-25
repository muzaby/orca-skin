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

test('separates a failed search, an empty search with expected sites, and a clean result', () => {
  const failed = (() => {
    try {
      execFileSync('node', [script, '--search', `rg -n 'boundary' ${dir}/missing`, '--sites', `${file}:5`], { encoding: 'utf8', stdio: 'pipe' })
      return 0
    } catch (error) {
      return error.status
    }
  })()
  assert.equal(failed, 2)
  const empty = (() => {
    try {
      execFileSync('node', [script, '--search', `rg -n 'nothing_matches_here' ${dir}`, '--sites', `${file}:5`], { encoding: 'utf8', stdio: 'pipe' })
      return 0
    } catch (error) {
      return error.status
    }
  })()
  assert.equal(empty, 3)
  const clean = run('--sites', `${file}:5-8,${file}:10`)
  assert.equal(clean.code, 0)
  assert.match(clean.out, /상태: 정상 — 미분류 0/)
})

test('skips option values before the pattern and refuses a pattern that does not match the hit lines', () => {
  const globFirst = execFileSync('node', [script, '--search', `rg -n -g '!*.test.*' -g '!*.md' '\\bboundary\\b' ${dir}`], { encoding: 'utf8' })
  assert.deepEqual(classes(globFirst), classes(run().out))
  const wrong = (() => {
    try {
      execFileSync('node', [script, '--search', `rg -n -i 'BOUNDARY' ${dir}`, '--sites', `${file}:5`], { encoding: 'utf8', stdio: 'pipe' })
      return 0
    } catch (error) {
      return error.status
    }
  })()
  assert.equal(wrong, 1, '-i 는 대소문자를 무시한 정규식으로 맞춘다 — 정상 검사(미분류 있음)지 명령 해석 실패(2)가 아니다')
  const mismatch = (() => {
    try {
      execFileSync('node', [script, '--search', `rg -n 'boundary' ${dir} | sed 's/boundary/x/'`], { encoding: 'utf8', stdio: 'pipe' })
      return 0
    } catch (error) {
      return error.status
    }
  })()
  assert.equal(mismatch, 2)
})

test('flags a listed range the search no longer reaches', () => {
  const stale = run('--sites', `${file}:5-8,${file}:10,${file}:40`)
  assert.equal(stale.code, 1)
  assert.match(stale.out, /목록만\t.*:40/)
})
