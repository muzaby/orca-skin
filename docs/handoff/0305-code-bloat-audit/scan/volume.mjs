#!/usr/bin/env node
// 0305 분량 지도 — 대상 파일을 버킷·종류로 분류하고 줄 수를 센다 (plan §10 EP-03).
// 사용: node volume.mjs            → data/volume.json 생성
//       node volume.mjs --check    → 미분류 0 · 합 = 총계 · 저장본 = 재생성본
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TARGETS = ['app/src', 'app/scripts', '.github/workflows']
export const KINDS = ['prod', 'test', 'test-support', 'data', 'doc', 'ci', 'tooling']

// 종류 규칙 V1~V8 — 위에서부터 첫 일치.
export function classifyKind(path) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (/\.test\.(ts|tsx|mjs|mts)$/.test(name)) return 'test' // V1
  if (
    /\.testfixture\./.test(name) ||
    path.includes('/fixtures/') ||
    path.includes('/__snapshots__/') ||
    /^mock-/.test(name) ||
    /\.mock\./.test(name) ||
    path === 'app/scripts/vitest-setup.mjs'
  )
    return 'test-support' // V2
  if (path.includes('/renderer/src/shared/i18n/resources/') || /\.(sql|pem|json)$/.test(name)) return 'data' // V3
  if (/\.md$/.test(name)) return 'doc' // V4
  if (/^\.github\/workflows\/[^/]+\.yml$/.test(path)) return 'ci' // V5
  if (path.startsWith('app/scripts/') && /\.(mjs|mts|cjs)$/.test(name)) return 'tooling' // V6
  if (/\.(ts|tsx|css|html)$/.test(name)) return 'prod' // V7
  return null // V8 — 미분류(red)
}

// 버킷 규칙 — 디렉토리 바로 아래 파일은 `(root)`.
export function classifyBucket(path) {
  const seg = path.split('/')
  const entry = (i) => (seg.length > i + 1 ? seg[i] : '(root)')
  if (path.startsWith('.github/workflows/')) return '.github/workflows'
  if (path.startsWith('app/scripts/')) return 'scripts'
  if (path.startsWith('app/src/preload/')) return 'preload'
  if (path.startsWith('app/src/shared/')) return `shared/${entry(3)}`
  if (path.startsWith('app/src/main/')) {
    if (seg.length === 4) return 'main/(root)'
    return `main/${seg[3]}/${entry(4)}`
  }
  if (path.startsWith('app/src/renderer/src/features/')) {
    if (seg.length === 6) return 'renderer/features/(root)'
    return `renderer/features/${seg[5]}/${entry(6)}`
  }
  if (path.startsWith('app/src/renderer/src/')) return `renderer/${entry(4)}`
  if (path.startsWith('app/src/renderer/')) return 'renderer/(root)'
  if (path.startsWith('app/src/')) return 'src/(root)'
  return null
}

export function classify(path) {
  return { bucket: classifyBucket(path), kind: classifyKind(path) }
}

export function countLines(text) {
  let n = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

// files: [{path, lines}] → 지도. 미분류는 unclassified 에 모은다.
export function buildVolume(files) {
  const buckets = {}
  const unclassified = []
  let totalLines = 0
  for (const { path, lines } of files) {
    totalLines += lines
    const { bucket, kind } = classify(path)
    if (!bucket || !kind) {
      unclassified.push(path)
      continue
    }
    const b = (buckets[bucket] ??= {})
    const k = (b[kind] ??= { files: 0, lines: 0 })
    k.files += 1
    k.lines += lines
  }
  const sorted = {}
  for (const name of Object.keys(buckets).sort()) {
    sorted[name] = {}
    for (const kind of KINDS) if (buckets[name][kind]) sorted[name][kind] = buckets[name][kind]
  }
  return { totals: { files: files.length, lines: totalLines }, unclassified, buckets: sorted }
}

export function checkVolume(volume) {
  const errors = []
  if (volume.unclassified.length) errors.push(`미분류 ${volume.unclassified.length}: ${volume.unclassified.slice(0, 5).join(', ')}`)
  let files = 0
  let lines = 0
  for (const b of Object.values(volume.buckets))
    for (const k of Object.values(b)) {
      files += k.files
      lines += k.lines
    }
  if (files !== volume.totals.files) errors.push(`파일 합 ${files} ≠ 총계 ${volume.totals.files}`)
  if (lines !== volume.totals.lines) errors.push(`줄 합 ${lines} ≠ 총계 ${volume.totals.lines}`)
  return errors
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim()
  const list = execFileSync('git', ['ls-files', ...TARGETS], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const files = list.map((path) => ({ path, lines: countLines(readFileSync(join(root, path), 'utf8')) }))
  const volume = buildVolume(files)
  const out = join(here, '..', 'data', 'volume.json')
  const text = JSON.stringify(volume, null, 1) + '\n'
  const errors = checkVolume(volume)
  if (process.argv.includes('--check')) {
    let saved = ''
    try {
      saved = readFileSync(out, 'utf8')
    } catch {
      errors.push('data/volume.json 없음')
    }
    if (saved && saved !== text) errors.push('저장본 ≠ 재생성본')
    if (errors.length) {
      for (const e of errors) console.error(`[volume] ${e}`)
      process.exit(1)
    }
    console.log(`[volume] ok — ${volume.totals.files} files · ${volume.totals.lines} lines · ${Object.keys(volume.buckets).length} buckets`)
    return
  }
  if (errors.length) {
    for (const e of errors) console.error(`[volume] ${e}`)
    process.exit(1)
  }
  writeFileSync(out, text)
  console.log(`[volume] wrote ${volume.totals.files} files · ${volume.totals.lines} lines · ${Object.keys(volume.buckets).length} buckets`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
