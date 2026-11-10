// 0305 L1 — prod export 중 다른 prod 파일이 참조하지 않는 것. 실행: cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const all = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))
const isTest = (f) => /\.test\.|\.testfixture\.|\.testHarness\.|\/fixtures\/|mock-/.test(f)
const prod = all.filter((f) => !isTest(f) && !f.includes('/i18n/resources/'))
const tests = all.filter(isTest)
const text = new Map(all.map((f) => [f, readFileSync(f, 'utf8')]))
const words = (s) => new Set(s.match(/[A-Za-z_$][\w$]*/g) ?? [])
const prodWords = new Map(prod.map((f) => [f, words(text.get(f))]))
const testWords = tests.map((f) => words(text.get(f)))
const rows = []
for (const f of prod) {
  const src = text.get(f)
  for (const m of src.matchAll(/^export (?:async )?(function|const|class|interface|type|enum) ([A-Za-z_$][\w$]*)/gm)) {
    const [, kind, name] = m
    let others = 0
    for (const [g, w] of prodWords) if (g !== f && w.has(name)) others++
    if (others > 0) continue
    const own = (src.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g')) ?? []).length
    const inTests = testWords.filter((w) => w.has(name)).length
    rows.push({ f, kind, name, own, inTests })
  }
}
const dead = rows.filter((r) => r.own === 1 && r.inTests === 0)
const testOnly = rows.filter((r) => r.own === 1 && r.inTests > 0)
const exportOnly = rows.filter((r) => r.own > 1)
console.log(`prod files ${prod.length} · 외부 prod 참조 0인 export ${rows.length} = dead ${dead.length} + testOnly ${testOnly.length} + 자기 파일 내부 사용 ${exportOnly.length}`)
const fmt = (r) => `${r.f.replace('src/', '')}:${r.name}(${r.kind}${r.inTests ? `,tests=${r.inTests}` : ''})`
console.log('--- dead'); console.log(dead.map(fmt).join('\n'))
console.log('--- testOnly'); console.log(testOnly.map(fmt).join('\n'))
