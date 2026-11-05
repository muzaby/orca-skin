// verify r4 독립 축(⑥) 탐침 — 332행 입력 목록 밖. 사용: node verify-r4-probes.mjs <appDir>
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
const app = resolve(process.argv[2] ?? '.')
const { analyzeScale } = await import(pathToFileURL(join(app, 'scripts/check-test-budgets.mjs')).href)
const F = 'main/x.test.ts'
const rows = [
  // [id, 칸 근거, 소스, 기대 위반 수(표 원문), 대조 행이면 control]
  ['Q1', 'KD05→KM08 (호출 결과 원천 구조 분해)', `import { getOpts } from './o'\nconst { ms } = getOpts()\nsetTimeout(f, ms)`, 1],
  ['Q1c', '대조: 같은 값 멤버 형태 KM08', `import { getOpts } from './o'\nsetTimeout(f, getOpts().ms)`, 1],
  ['Q2', 'KD05→KD04 (for-of 구조 분해)', `const cases = [{ ms: 5000 }]\nfor (const { ms } of cases) setTimeout(f, ms)`, 1],
  ['Q2c', '대조: for-of 식별자 KD04', `for (const ms of [5000]) setTimeout(f, ms)`, 1],
  ['Q3', 'KD05→KV14 (await 원천 구조 분해)', `import { load } from './o'\nconst { ms } = await load()\nsetTimeout(f, ms)`, 1],
  ['Q3c', '대조: (await load()).ms', `import { load } from './o'\nsetTimeout(f, (await load()).ms)`, 1],
  ['Q4', 'KD05 배열 구조 분해 ← 호출', `import { pair } from './o'\nconst [ms] = pair()\nsetTimeout(f, ms)`, 1],
  ['Q5', 'KD05 정상: 객체 리터럴 원천', `const { ms } = { ms: 5000 }\nsetTimeout(f, ms)`, 1],
  ['Q6', 'KD05 정상: scaleMs 원천', `import { scaleMs } from '../scripts/test-time.mjs'\nconst { ms } = { ms: scaleMs(5000) }\nsetTimeout(f, ms)`, 0],
  ['Q7', 'KC06 namespace import child_process — 무임계', `import * as child from 'node:child_process'\nchild.execFileSync('git', [], { timeout: 500 })`, 1],
  ['Q7c', '대조: named import 무임계', `import { execFileSync } from 'node:child_process'\nexecFileSync('git', [], { timeout: 500 })`, 1],
  ['Q8', 'KM06 생성자 대입 this.ms (표 원문은 초기값만)', `class A { ms = 500; constructor() { this.ms = 5000 } run() { setTimeout(f, this.ms) } }`, 1],
  ['Q9', 'KD01 구조 분해 대입 ({ ms } = …)', `let ms = 500\n;({ ms } = { ms: 5000 })\nsetTimeout(f, ms)`, 1],
]
let bad = 0
for (const [id, cell, src, want] of rows) {
  const got = analyzeScale(F, src, [], []).length
  const ok = got === want
  if (!ok) bad++
  console.log([id, cell, `기대 ${want}`, `현재 ${got}`, ok ? 'ok' : 'MISMATCH'].join('\t'))
}
console.log(`탐침 ${rows.length} · 불일치 ${bad}`)
