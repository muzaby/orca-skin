// verify r5 독립 축(⑥) 탐침 — 368행 입력 목록 밖. 사용: node verify-r5-probes.mjs <appDir>
// 측정 vc = 위반 수/판정 불가 수/판정 불가 칸 ID (dv5-cells.mjs 와 같은 측정)
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
const app = resolve(process.argv[2] ?? '.')
const { analyzeScale } = await import(pathToFileURL(join(app, 'scripts/check-test-budgets.mjs')).href)
const vc = (code) => {
  const out = analyzeScale('a.test.ts', code, [], [])
  const red = out.filter((l) => l.includes('판정 불가'))
  const ids = red.map((l) => (l.match(/판정 불가 ([A-Z]{2}\d+[a-z]?)/) ?? [, '?'])[1]).sort()
  return `${out.length}/${red.length}/${ids.join(',') || '-'}`
}
const IMP = (n) => `import { ${n} } from './o'\n`
// [id, 칸 근거, 소스, 기대(표 원문으로 유도)]
const rows = [
  ['R1', 'KD15 변수 증감 — for 문 갱신식', `for (let ms = 500; ms < 600; ms++) setTimeout(f, ms)`, '1/1/KD15'],
  ['R2', 'KD15 — 구조 분해로 선언한 변수의 증감', `let { ms } = { ms: 500 }\nms++\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['R2c', '대조: 같은 변수의 복합 대입(KD02)', `let { ms } = { ms: 500 }\nms += 4500\nsetTimeout(f, ms)`, '1/1/KD02'],
  ['R3', 'KD15 — 매개변수 증감', `function run(ms) { ms++; setTimeout(f, ms) }\nrun(500)`, '1/1/KD15'],
  ['R4', 'KD15 — for-of 머리의 구조 분해 대입 대상', `let ms = 500\nfor ({ ms } of [{ ms: 5000 }]) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['R5', 'KM10 — 객체 멤버 대입 뒤 구조 분해로 읽음', `const o = { ms: 500 }\no.ms = 5000\nconst { ms } = o\nsetTimeout(f, ms)`, '1/0/-'],
  ['R5c', '대조: 같은 값 멤버 읽기(KM10f)', `const o = { ms: 500 }\no.ms = 5000\nsetTimeout(f, o.ms)`, '1/0/-'],
  ['R6', 'KM11 — 객체 멤버 증감 뒤 구조 분해로 읽음', `const o = { ms: scaleMs(500) }\no.ms++\nconst { ms } = o\nsetTimeout(f, ms)`, '1/1/KM11'],
  ['R7', 'KD05 — 원천 변수 후보가 리터럴 + 호출(재대입)', `${IMP('getOpts')}let r = {}\nr = getOpts()\nconst { ms } = r\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R7c', '대조: 같은 원천 멤버 읽기', `${IMP('getOpts')}let r = {}\nr = getOpts()\nsetTimeout(f, r.ms)`, '1/1/KM08'],
  ['R7b', 'KD05 — 원천 후보가 키 있는 리터럴 + 호출(재대입)', `${IMP('getOpts')}let r = { ms: 500 }\nr = getOpts()\nconst { ms } = r\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R7bc', '대조: 같은 원천 멤버 읽기', `${IMP('getOpts')}let r = { ms: 500 }\nr = getOpts()\nsetTimeout(f, r.ms)`, '1/1/KM08'],
  ['R8', 'KD05 — 원천 = 조건식(빈 객체 | 호출)', `${IMP('getOpts')}const { ms } = cond ? {} : getOpts()\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R8c', '대조: 같은 원천 멤버 읽기', `${IMP('getOpts')}setTimeout(f, (cond ? {} : getOpts()).ms)`, '1/1/KM08'],
  ['R8b', 'KD05 — 원천 = 조건식(키 있는 객체 | 호출)', `${IMP('getOpts')}const { ms } = cond ? { ms: 500 } : getOpts()\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R9', 'KD05 — 중첩 패턴 · 바깥 원천 = 호출', `${IMP('getOpts')}const { a: { ms } } = getOpts()\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R10', 'KD05 — 원천 = new 식 → KM08', `const { ms } = new Opts()\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R11', 'KD05 — 원천 = 호출 결과를 담은 변수', `${IMP('getOpts')}const r = getOpts()\nconst { ms } = r\nsetTimeout(f, ms)`, '1/1/KM08'],
  ['R12', 'KD05 — 원천 = import 멤버 → KM07', `${IMP('cfg')}const { ms } = cfg.opts\nsetTimeout(f, ms)`, '0/0/-'],
  ['R13', 'KM11 — 멤버 &&= (복합 대입)', `const o = { ms: 500 }\no.ms &&= 5000\nsetTimeout(f, o.ms)`, '1/1/KM11'],
  ['R14', 'KM11 — 배열 구조 분해 대입의 멤버 대상', `const o = { ms: 500 }\n;[o.ms] = [5000]\nsetTimeout(f, o.ms)`, '1/1/KM11'],
  ['R15', 'KM10 — this 멤버 ||= 대입(초기값 500)', `class A { ms = 500; init() { this.ms ||= 5000 } run() { setTimeout(f, this.ms) } }`, '1/0/-'],
  ['R16', 'KM10 — 객체 멤버 대입 우변이 호출 → KF05', `${IMP('getMs')}const o = { ms: scaleMs(500) }\no.ms = getMs()\nsetTimeout(f, o.ms)`, '1/1/KF05'],
  ['R17', 'KM10 — 클래스 식(this 대입)', `const A = class { ms = 500; constructor() { this.ms = 5000 } run() { setTimeout(f, this.ms) } }`, '1/0/-'],
  ['R18', 'KD15 — 구조 분해 대입 기본값 대상', `let ms\n;({ ms = 5000 } = {})\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['R19', 'KD15 — 나머지 요소 대입 대상', `let rest\n;({ ...rest } = { ms: 5000 })\nsetTimeout(f, rest.ms)`, '1/1/KD15'],
]
let bad = 0
for (const [id, cell, src, want] of rows) {
  let got
  try { got = vc(src) } catch (e) { got = `ERR ${String(e.message).split('\n')[0]}` }
  const ok = got === want
  if (!ok) bad++
  console.log([id, cell, `기대 ${want}`, `현재 ${got}`, ok ? 'ok' : 'MISMATCH'].join('\t'))
}
console.log(`탐침 ${rows.length} · 불일치 ${bad}`)
