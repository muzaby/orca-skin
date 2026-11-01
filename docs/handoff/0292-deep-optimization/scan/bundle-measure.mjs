// 0292 번들 측정기 — renderer 진입 청크 크기·압축 여부·패키지 계열별 바이트·자산 수를 낸다.
// 사용: node docs/handoff/0292-deep-optimization/scan/bundle-measure.mjs <outDir>
//   <outDir> = `electron-vite build --sourcemap --outDir <outDir>` 결과(app 디렉터리에서 실행).
// 출력 JSON 은 baseline/bundle.json 과 같은 키를 갖는다. 바이트 귀속은 소스맵 매핑 구간 길이로 센다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const outDir = process.argv[2]
if (!outDir) throw new Error('usage: bundle-measure.mjs <outDir>')
const require = createRequire(join(process.cwd(), 'package.json'))
const { TraceMap, eachMapping } = require('@jridgewell/trace-mapping')

const assetsDir = join(outDir, 'renderer', 'assets')
const assets = readdirSync(assetsDir).filter((name) => !name.endsWith('.map'))
const entries = assets.filter((name) => /^index-.*\.js$/.test(name))
if (entries.length !== 1) throw new Error(`entry chunk count ${entries.length}`)
const entryPath = join(assetsDir, entries[0])
const code = readFileSync(entryPath, 'utf8')
const lines = code.split('\n')

// 소스별 바이트(매핑 시작점부터 다음 매핑까지의 생성 코드 길이).
const bySource = new Map()
let mapFound = true
let prev = null
const add = (endLine, endCol) => {
  if (!prev) return
  let bytes
  if (prev.line === endLine) bytes = endCol - prev.col
  else {
    bytes = (lines[prev.line - 1]?.length ?? 0) - prev.col
    for (let l = prev.line + 1; l < endLine; l++) bytes += (lines[l - 1]?.length ?? 0) + 1
    bytes += endCol
  }
  bySource.set(prev.source ?? '(none)', (bySource.get(prev.source ?? '(none)') ?? 0) + Math.max(0, bytes))
}
try {
  const map = new TraceMap(JSON.parse(readFileSync(`${entryPath}.map`, 'utf8')))
  eachMapping(map, (m) => {
    add(m.generatedLine, m.generatedColumn)
    prev = { line: m.generatedLine, col: m.generatedColumn, source: m.source }
  })
  add(lines.length, lines.at(-1).length)
} catch {
  mapFound = false
}

const packageOf = (source) => {
  const at = source.lastIndexOf('node_modules/')
  if (at < 0) return 'app'
  const parts = source.slice(at + 13).split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}
// 계열 = 그 기능만 끌어오는 패키지 집합(0292 §8 실측으로 고정).
const FAMILIES = {
  recharts:
    /^(recharts|@reduxjs\/toolkit|immer|redux|redux-thunk|reselect|react-redux|d3-.*|internmap|decimal\.js-light|es-toolkit|eventemitter3|victory-vendor|tiny-invariant)$/,
  shiki:
    /^(shiki|@shikijs\/.*|oniguruma-to-es|regex|regex-recursion|regex-utilities|hast-util-to-html|emoji-regex-xs)$/
}
const families = Object.fromEntries(Object.keys(FAMILIES).map((key) => [key, 0]))
for (const [source, bytes] of bySource) {
  const pkg = packageOf(source)
  for (const [key, pattern] of Object.entries(FAMILIES)) if (pattern.test(pkg)) families[key] += bytes
}

const maxLine = lines.reduce((max, line) => Math.max(max, line.length), 0)
const rendererBytes = assets.reduce((sum, name) => sum + statSync(join(assetsDir, name)).size, 0)
console.log(
  JSON.stringify(
    {
      entryChunk: 'index.js',
      entryBytes: Buffer.byteLength(code),
      entryLines: lines.length,
      // 압축 판정: 1MB 이상 청크가 1만 줄 미만이면 압축본으로 본다(원본 103,087줄 · 압축본 수십 줄).
      entryMinified: lines.length < 10000,
      maxLineLength: maxLine,
      sourceMap: mapFound,
      familyBytes: mapFound ? families : null,
      assetCount: assets.length,
      rendererAssetBytes: rendererBytes
    },
    null,
    1
  )
)
