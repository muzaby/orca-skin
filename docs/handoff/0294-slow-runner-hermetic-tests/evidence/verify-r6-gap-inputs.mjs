// verify r6 — UT 입력 칸이 규칙 칸보다 좁은 분기(D9 재개방·D12~D14)의 입력과 기대. 사용: node verify-r6-gap-inputs.mjs <appDir>
// 기대는 plan §7-G 칸 문장에서 유도했고, HEAD(e74bf3e) 코드는 전부 기대와 같다 — 코드가 아니라 입력이 빠졌다.
// 측정 vc = 위반 수/판정 불가 수/판정 불가 칸 ID (dv6-cells.mjs 와 같은 측정)
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
// [ID, 이슈, 칸 근거(§7-G), 소스, 기대, 이 입력이 잡는 변이]
const rows = [
  ['G01', 'D9', 'KD05 "원천 후보마다" — 호출 → 빈 리터럴 재대입(호출이 먼저)', `${IMP('getOpts')}let r = getOpts()\nr = {}\nconst { ms } = r\nsetTimeout(f, ms)`, '1/1/KM08', 'sv39 마지막 후보만 판정'],
  ['G01m', 'D9', '짝: 같은 원천 멤버 읽기', `${IMP('getOpts')}let r = getOpts()\nr = {}\nsetTimeout(f, r.ms)`, '1/1/KM08', 'sv39'],
  ['G02', 'D9', 'KD05 "원천 후보마다" — 조건식 역순(호출 | 빈 객체)', `${IMP('getOpts')}const { ms } = cond ? getOpts() : {}\nsetTimeout(f, ms)`, '1/1/KM08', 'sv39'],
  ['G03', 'D9', 'KD05 "원천 후보마다" — 호출 → 키 있는 리터럴(5000) 재대입: 위반 1 + 판정 불가', `${IMP('getOpts')}let r = getOpts()\nr = { ms: 5000 }\nconst { ms } = r\nsetTimeout(f, ms)`, '2/1/KM08', 'sv39'],
  ['G03m', 'D9', '짝: 같은 원천 멤버 읽기', `${IMP('getOpts')}let r = getOpts()\nr = { ms: 5000 }\nsetTimeout(f, r.ms)`, '2/1/KM08', 'sv39'],
  ['G04', 'D12', 'KM10 "원천 사슬에 구조 분해 요소의 대입 우변이 든다"', `let { o } = { o: { ms: scaleMs(500) } }\no = { ms: 5000 }\nsetTimeout(f, o.ms)`, '1/0/-', 'sv17 expand 구조 분해 요소 대입 우변 제거'],
  ['G04m', 'D12', '대조: 일반 변수 대입 뒤 멤버 읽기(KM10 기존)', `let o = { ms: scaleMs(500) }\no = { ms: 5000 }\nsetTimeout(f, o.ms)`, '1/0/-', '—'],
  ['G05', 'D13', 'KD05 "배열 패턴 원천[i]" + KM10 멤버 대입 우변', `const arr = [scaleMs(500)]\narr[0] = 5000\nconst [ms] = arr\nsetTimeout(f, ms)`, '1/0/-', 'sv28 배열 패턴 키 제거'],
  ['G05m', 'D13', '짝: 같은 원천 멤버 읽기', `const arr = [scaleMs(500)]\narr[0] = 5000\nsetTimeout(f, arr[0])`, '1/0/-', 'sv28'],
  ['G06', 'D13', 'KD05 "배열 패턴 원천[i]" + KM11 증감 red', `const arr = [scaleMs(500)]\narr[0]++\nconst [ms] = arr\nsetTimeout(f, ms)`, '1/1/KM11', 'sv28'],
  ['G06m', 'D13', '짝: 같은 원천 멤버 읽기', `const arr = [scaleMs(500)]\narr[0]++\nsetTimeout(f, arr[0])`, '1/1/KM11', 'sv28'],
  ['G07', 'D14', 'KD05 "호출부 없는 매개변수 KD08(기본값은 후보로 남는다)" — 기본값 5000이 후보', `function run({ ms = 5000 }) { setTimeout(f, ms) }`, '1/0/-', 'sv14 후보가 있어도 KD08 bound'],
  ['G07b', 'D14', '구별: 기본값 scaleMs — 위반 0', `function run({ ms = scaleMs(500) }) { setTimeout(f, ms) }`, '0/0/-', 'sv14'],
  ['G07c', 'D14', '구별: 기본값 없음 → KD08 bound, 위반 0', `function run({ ms }) { setTimeout(f, ms) }`, '0/0/-', '—'],
  ['G08', 'D16', 'KD05 "(중첩 포함)" — 3단 중첩 값: 바깥 패턴의 원천 멤버가 두 번 이어진다', `const { a: { b: { ms } } } = { a: { b: { ms: 5000 } } }\nsetTimeout(f, ms)`, '1/0/-', 'C035 bindingElementSources 중첩 분기 제거'],
  ['G08b', 'D16', '구별: 3단 중첩 값 scaleMs — 위반 0', `const { a: { b: { ms } } } = { a: { b: { ms: scaleMs(500) } } }\nsetTimeout(f, ms)`, '0/0/-', 'C035'],
  ['G09', 'D16', 'KD05 "원천 식 = 바깥 패턴의 원천 멤버" — 중첩 요소를 원천으로 멤버 읽기', `const { a: { b } } = { a: { b: { ms: 5000 } } }\nsetTimeout(f, b.ms)`, '1/0/-', 'C035'],
  ['G10', 'D16', '중첩 요소를 원천으로 구조 분해 읽기', `const { a: { b } } = { a: { b: { ms: 5000 } } }\nconst { ms } = b\nsetTimeout(f, ms)`, '1/0/-', 'C035']
]
let bad = 0
for (const [id, issue, why, src, want] of rows) {
  const got = vc(src)
  const ok = got === want
  if (!ok) bad++
  console.log(`${id}\t${issue}\t${why}\t기대 ${want}\t현재 ${got}\t${ok ? 'ok' : 'MISMATCH'}`)
}
console.log(`입력 ${rows.length} · 불일치 ${bad}`)
