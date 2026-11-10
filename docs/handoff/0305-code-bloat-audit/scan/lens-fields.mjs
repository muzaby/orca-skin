// 0305 L1 — 스키마 필드 중 renderer 또는 main 참조가 0인 것. 실행: cd app/src && node ../../docs/handoff/0305-code-bloat-audit/scan/lens-fields.mjs
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const src = readFileSync('shared/protocol.ts', 'utf8')
const files = execFileSync('git', ['ls-files', 'renderer', 'preload', 'main', 'shared'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.|testfixture|testHarness|testlib|\.d\.ts|i18n\/resources/.test(f))
const text = Object.fromEntries(files.map((f) => [f, readFileSync(f, 'utf8')]))
const count = (name, pred) => Object.entries(text).filter(([f, t]) => pred(f) && new RegExp(`\\b${name}\\b`).test(t)).length
const seen = new Set()
let schema = null
for (const line of src.split('\n')) {
  let m
  if ((m = /^(?:export )?const (\w+Schema)\b/.exec(line))) schema = m[1]
  if (!schema) continue
  if ((m = /^\s{2,6}(\w+): z\./.exec(line))) {
    const name = m[1]
    if (seen.has(schema + name)) continue
    seen.add(schema + name)
    const r = count(name, (f) => f.startsWith('renderer'))
    const mn = count(name, (f) => f.startsWith('main'))
    if (r === 0 || mn === 0) console.log(`${schema}.${name} renderer=${r} main=${mn}`)
  }
}
