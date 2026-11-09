#!/usr/bin/env node
// 0300 git 실행 집계 — spawn-trace.mjs 가 남긴 <dir>/*.jsonl 을 파일별로 센다.
//   test-side  : 호출 스택에 테스트 소스(*.test.ts · *.testfixture.ts) 프레임이 있고
//                production 프레임(infra/git/runner.ts 제외)이 없다 — 테스트가 직접 띄운 git
//   production : 그 밖 — 테스트가 부른 production 코드가 띄운 git(스택이 비동기로 끊긴 것 포함)
//   build      : test-side 중 저장소 구성 명령(init·add·commit·fast-import)
// 사용: node git-spawn-census.mjs <trace-dir> [--max-total N] [--max-test-side N] [--max-file <path>=N ...]
//   임계를 넘으면 그 줄을 출력하고 exit 1 — 0300 VP-02 gate.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [dir, ...flags] = process.argv.slice(2)
const limits = { total: Infinity, testSide: Infinity, files: new Map() }
for (let i = 0; i < flags.length; i += 2) {
  const value = flags[i + 1]
  if (flags[i] === '--max-total') limits.total = Number(value)
  else if (flags[i] === '--max-test-side') limits.testSide = Number(value)
  else if (flags[i] === '--max-file') {
    const at = value.lastIndexOf('=')
    limits.files.set(value.slice(0, at), Number(value.slice(at + 1)))
  } else throw new Error(`unknown flag ${flags[i]}`)
}
const isTest = (file) => /\.test\.tsx?$|\.testfixture\.tsx?$/.test(file)
const BUILD = new Set(['init', 'add', 'commit', 'fast-import'])
const verbOf = (args) => {
  let k = 0
  while (k < args.length && (args[k] === '-C' || args[k] === '-c' || args[k] === '--no-optional-locks'))
    k += args[k] === '--no-optional-locks' ? 1 : 2
  return args[k] ?? '?'
}
const rows = []
for (const name of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
  const lines = readFileSync(join(dir, name), 'utf8').split('\n').filter(Boolean)
  if (lines.length === 0) continue
  const row = { file: name.replace(/\.jsonl$/, '').replace(/_/g, '/'), total: 0, testSide: 0, production: 0, build: 0 }
  for (const line of lines) {
    const { args, frames } = JSON.parse(line)
    const testFrames = frames.filter((f) => isTest(f.file))
    const prod = frames.some((f) => !isTest(f.file) && !/infra\/git\/runner\.ts$/.test(f.file))
    row.total++
    if (testFrames.length > 0 && !prod) {
      row.testSide++
      if (BUILD.has(verbOf(args))) row.build++
    } else row.production++
  }
  rows.push(row)
}
rows.sort((a, b) => b.total - a.total)
const sum = (k) => rows.reduce((t, r) => t + r[k], 0)
console.log(['file', 'total', 'test-side', 'build', 'production'].join('\t'))
for (const r of rows) console.log([r.file, r.total, r.testSide, r.build, r.production].join('\t'))
console.log(['SUM', sum('total'), sum('testSide'), sum('build'), sum('production')].join('\t'))

const over = []
if (sum('total') > limits.total) over.push(`total ${sum('total')} > ${limits.total}`)
if (sum('testSide') > limits.testSide) over.push(`test-side ${sum('testSide')} > ${limits.testSide}`)
for (const [file, max] of limits.files) {
  const row = rows.find((r) => r.file === file)
  if (!row) over.push(`${file}: trace 없음`)
  else if (row.total > max) over.push(`${file} total ${row.total} > ${max}`)
}
for (const line of over) console.error(`[census] over: ${line}`)
process.exitCode = over.length ? 1 : 0
