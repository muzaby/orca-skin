#!/usr/bin/env node
// 0261 ST-02 (AC6) — production 번들의 모든 창 생성자 자리가 `devTools: false` 를 싣는지 본다.
//
// 사용: (cd app && npx electron-vite build) && node docs/handoff/0261-bypass-flag-prod-devtools/check-prod-bundle.mjs
//
// 번들 자리 수는 소스(app/src/main, 테스트 제외) 자리 수와 같아야 한다 — 빠진 자리가 없다는 주장의 관측은
// 두 집합의 차이다. 소스 쪽 술어는 `browser-window-devtools.test.ts` 와 같은 주어(창 생성자 호출)다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SRC = join(ROOT, 'app/src/main')
const OUT = join(ROOT, 'app/out/main')
const CTOR = /new\s+(?:[\w$]+\.)?(?:BrowserWindow|BrowserView|WebContentsView)\s*\(/g

function walk(dir, keep) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full, keep) : keep(entry) ? [full] : []
  })
}

// `app/src/main/infra/source-scan.ts` 의 stripCommentsAndStrings 와 같은 식 — 소스 자리만 센다.
function stripSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
}

// 번들은 정규식으로 문자열을 지우면 다른 리터럴에 걸려 코드가 먹힐 수 있다 — 괄호 짝을 찾는 동안만
// 따옴표 구간을 건너뛴다.
function balanced(text, open) {
  const closing = { '(': ')', '{': '}', '[': ']' }
  const stack = []
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++
      continue
    }
    if (c in closing) stack.push(closing[c])
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return undefined
      if (stack.length === 0) return text.slice(open, i + 1)
    }
  }
  return undefined
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

const sourceSites = walk(SRC, (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).flatMap((file) =>
  [...stripSource(readFileSync(file, 'utf8')).matchAll(CTOR)].map(() => relative(ROOT, file))
)

let bundleFiles
try {
  bundleFiles = walk(OUT, (f) => f.endsWith('.js'))
} catch {
  console.error(`번들 없음: ${relative(ROOT, OUT)} — 먼저 (cd app && npx electron-vite build)`)
  process.exit(2)
}

const problems = []
const bundleSites = bundleFiles.flatMap((file) => {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(CTOR)].map((m) => {
    const at = `${relative(ROOT, file)}:${lineOf(text, m.index)}`
    const args = balanced(text, m.index + m[0].length - 1)
    const key = args?.match(/\bwebPreferences\s*:\s*\{/)
    const block = key ? balanced(args, key.index + key[0].length - 1) : undefined
    const values = block ? [...block.matchAll(/\bdevTools\s*:\s*([^,}\s]+)/g)].map((v) => v[1]) : []
    if (values.length !== 1 || !/^(false|!1)$/.test(values[0])) {
      problems.push(`${at} devTools=${JSON.stringify(values)} — 정확히 하나의 false 여야 한다`)
    }
    return { at, values }
  })
})

for (const site of bundleSites) console.log(`번들 자리 ${site.at}  devTools=${site.values.join(',') || '(없음)'}`)
console.log(`소스 자리 ${sourceSites.length} (${sourceSites.join(' · ')}) · 번들 자리 ${bundleSites.length}`)
if (sourceSites.length === 0) problems.push('소스 자리 0 — 스캔이 눈을 잃었다')
if (bundleSites.length !== sourceSites.length) {
  problems.push(`자리 수 불일치 — 소스 ${sourceSites.length} · 번들 ${bundleSites.length}`)
}
for (const p of problems) console.log(`위반: ${p}`)
console.log(problems.length === 0 ? '판정: 모든 창 생성자가 devTools:false' : `판정: 위반 ${problems.length}건`)
process.exit(problems.length === 0 ? 0 : 1)
