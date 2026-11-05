// 0294 ΔV6 — verify r5 D9(KD05 혼합 원천 — 이행) · D10(KD05 원천 멤버 문장 정합) · D11(창 안 확장 채택: 모든 이름 바인딩의
// 대입·증감·구조 분해 대입 · for-of/for-in 머리 대입 대상)의 칸 입력과 기대. 판정 기대의 정본은 plan §7-G 표이고 이 파일은 그 입력의
// 실행본이다. dv3-branches.mjs · dv4-cells.mjs · dv5-cells.mjs 와 함께 돈다.
// 사용: node dv6-cells.mjs <app 디렉토리> [--only-mismatch]
// 측정 vc = `위반 수/판정 불가 수/판정 불가 칸 ID(정렬, 쉼표)`(analyzeScale, 의미 값·허용 항목 없음)
// 짝 행(…m)은 같은 원천의 멤버 읽기 형태다 — D-020 "구조 분해 값 = 같은 원천의 멤버 읽기 판정"의 대칭을 행 쌍으로 잠근다.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const appDir = resolve(process.argv[2] ?? '.')
const onlyMismatch = process.argv.includes('--only-mismatch')
const { analyzeScale } = await import(pathToFileURL(`${appDir}/scripts/check-test-budgets.mjs`).href)
const vc = (code) => {
  const out = analyzeScale('a.test.ts', code, [], [])
  const red = out.filter((l) => l.includes('판정 불가'))
  const ids = red.map((l) => (l.match(/판정 불가 ([A-Z]{2}\d+[a-z]?)/) ?? [, '?'])[1]).sort()
  return `${out.length}/${red.length}/${ids.join(',') || '-'}`
}

const IMP = (name) => `import { ${name} } from './o'\n`
// [ID, 칸, 규칙 조각, 기대, 소스, 출처]
const C = [
  // KD05 — 구조 분해 값 = 기본값 ∪ 대입 우변 ∪ 원천 멤버(같은 원천의 멤버 읽기 판정, 원천 후보마다). 후보 유무와 무관.
  ['KD05l', 'KD05·KM08', '원천 변수 후보 = 빈 리터럴 + 호출(재대입) → 호출 후보가 KM08', '1/1/KM08', `${IMP('getOpts')}let r = {}\nr = getOpts()\nconst { ms } = r\nsetTimeout(f, ms)`, 'verify r5 R7 (D9)'],
  ['KD05lm', 'KM08', '짝: 같은 원천 멤버 읽기', '1/1/KM08', `${IMP('getOpts')}let r = {}\nr = getOpts()\nsetTimeout(f, r.ms)`, 'verify r5 R7c'],
  ['KD05m', 'KD05·KM08', '원천 = 조건식(빈 객체 | 호출) → KM08', '1/1/KM08', `${IMP('getOpts')}const { ms } = cond ? {} : getOpts()\nsetTimeout(f, ms)`, 'verify r5 R8 (D9)'],
  ['KD05n', 'KD05·KM08', '원천 변수 후보 = 키 있는 리터럴 + 호출 → 리터럴 값과 KM08 둘 다', '1/1/KM08', `${IMP('getOpts')}let r = { ms: 500 }\nr = getOpts()\nconst { ms } = r\nsetTimeout(f, ms)`, 'verify r5 R7b (D10)'],
  ['KD05nm', 'KM08', '짝: 같은 원천 멤버 읽기', '1/1/KM08', `${IMP('getOpts')}let r = { ms: 500 }\nr = getOpts()\nsetTimeout(f, r.ms)`, 'verify r5 R7bc'],
  ['KD05o', 'KD05·KM08', '원천 = 조건식(키 있는 객체 | 호출) → KM08', '1/1/KM08', `${IMP('getOpts')}const { ms } = cond ? { ms: 500 } : getOpts()\nsetTimeout(f, ms)`, 'verify r5 R8b (D10)'],
  ['KD05p', 'KD05·KM10', '원천 객체 멤버 대입 우변이 후보(후보 있음)', '1/0/-', `const o = { ms: 500 }\no.ms = 5000\nconst { ms } = o\nsetTimeout(f, ms)`, 'verify r5 R5 (D10)'],
  ['KD05pm', 'KM10', '짝: 같은 원천 멤버 읽기(KM10f)', '1/0/-', `const o = { ms: 500 }\no.ms = 5000\nsetTimeout(f, o.ms)`, 'verify r5 R5c'],
  ['KD05q', 'KD05·KM11', '원천 객체 멤버 증감 → KM11', '1/1/KM11', `const o = { ms: scaleMs(500) }\no.ms++\nconst { ms } = o\nsetTimeout(f, ms)`, 'verify r5 R6 (D10)'],
  ['KD05r', 'KD05·KM10', '중첩 패턴 — 안쪽 원천 멤버 대입 우변이 후보', '1/0/-', `const o = { a: { ms: 500 } }\no.a.ms = 5000\nconst { a: { ms } } = o\nsetTimeout(f, ms)`, '설계자 전수(R5 형제)'],
  ['KD05rm', 'KM10', '짝: 같은 원천 멤버 읽기', '1/0/-', `const o = { a: { ms: 500 } }\no.a.ms = 5000\nsetTimeout(f, o.a.ms)`, '설계자 전수'],
  ['KD05s', 'KD05·KM10', 'this 원천 — 같은 클래스 대입 우변이 후보', '1/0/-', `class A { ms = 500; constructor() { this.ms = 5000 } run() { const { ms } = this; setTimeout(f, ms) } }`, '설계자 전수(KM10a 형제)'],
  ['KD05t', 'KD05·KM06', 'this 원천 — 선언·대입 모두 없음 → KM06', '1/1/KM06', `class A { run() { const { ms } = this; setTimeout(f, ms) } }`, '설계자 전수(KM06d 형제)'],
  ['KD05u', 'KD05·KD04', 'for-of 구조 분해 — 기본값이 있어도 KD04', '1/1/KD04', `const cases = [{ ms: 5000 }]\nfor (const { ms = 500 } of cases) setTimeout(f, ms)`, '설계자 전수(D10 — 후보 유무와 무관)'],
  ['KD05v', 'KD05·KD13', 'catch 구조 분해 — 기본값이 있어도 KD13', '1/1/KD13', `try { run() } catch ({ ms = 500 }) { setTimeout(f, ms) }`, '설계자 전수(D10)'],
  ['KD05w', 'KD05', '구별: 혼합 원천이 모두 배율 → 위반 0', '0/0/-', `const { ms } = cond ? { ms: scaleMs(1000) } : { ms: scaleMs(2000) }\nsetTimeout(f, ms)`, '설계자 전수(과잉 판정 잠금)'],
  ['KD05x', 'KD05·KM07', '구별: 원천 = 빈 리터럴 | import → KM02 · KM07 경계 → 위반 0', '0/0/-', `${IMP('cfg')}const { ms } = cond ? {} : cfg\nsetTimeout(f, ms)`, '설계자 전수(과잉 판정 잠금)'],
  ['KD05y', 'KD05', '구별: 다른 키의 멤버 대입은 후보 아님', '0/0/-', `const o = { ms: scaleMs(500), other: 0 }\no.other = 5000\nconst { ms } = o\nsetTimeout(f, ms)`, '설계자 전수(KM10m 형제)'],
  ['KD05z', 'KD05', '기본값 + 원천 키 없음 → 기본값만 후보', '1/0/-', `const { ms = 5000 } = {}\nsetTimeout(f, ms)`, '설계자 전수(기존 유지)'],
  // KD01·KD02·KD15 — "변수" = 같은 파일의 모든 이름 바인딩(변수 선언 · 구조 분해 선언 요소 · 매개변수)
  ['KD15h', 'KD15', '구조 분해 선언 요소의 증감', '1/1/KD15', `let { ms } = { ms: 500 }\nms++\nsetTimeout(f, ms)`, 'verify r5 R2 (D11)'],
  ['KD02b', 'KD02', '구조 분해 선언 요소의 복합 대입', '1/1/KD02', `let { ms } = { ms: 500 }\nms += 4500\nsetTimeout(f, ms)`, 'verify r5 R2c (D11)'],
  ['KD15i', 'KD15', '매개변수 증감', '1/1/KD15', `function run(ms) { ms++; setTimeout(f, ms) }\nrun(500)`, 'verify r5 R3 (D11)'],
  ['KD02c', 'KD02', '매개변수 복합 대입', '1/1/KD02', `function run(ms) { ms += 4500; setTimeout(f, ms) }\nrun(500)`, '설계자 전수(R3 형제)'],
  ['KD15j', 'KD15', '구조 분해 매개변수 요소의 구조 분해 대입 대상', '1/1/KD15', `function run({ ms }) { ;({ ms } = { ms: 5000 }); setTimeout(f, ms) }\nrun({ ms: 500 })`, '설계자 전수'],
  ['KD01b', 'KD01', '매개변수 = 대입 우변이 후보', '1/0/-', `function run(ms) { ms = 5000; setTimeout(f, ms) }\nrun(500)`, '설계자 전수(D11 형제)'],
  ['KD01c', 'KD01', '구조 분해 선언 요소 = 대입 우변이 후보', '1/0/-', `let { ms } = { ms: 500 }\nms = 5000\nsetTimeout(f, ms)`, '설계자 전수(D11 형제)'],
  ['KD01d', 'KD01', '구조 분해 매개변수 요소 ??= 대입 우변이 후보', '1/0/-', `function run({ ms }) { ms ??= 5000; setTimeout(f, ms) }\nrun({ ms: 500 })`, '설계자 전수(D11 형제)'],
  ['KD01e', 'KD01·KD08', '호출부 없는 매개변수 + 대입 → 우변이 후보', '1/0/-', `export function run(ms) { ms = 5000; setTimeout(f, ms) }`, '설계자 전수'],
  ['KD01f', 'KD01', '구별: 매개변수 배율 대입', '0/0/-', `function run(ms) { ms = scaleMs(5000); setTimeout(f, ms) }\nrun(scaleMs(500))`, '설계자 전수(과잉 판정 잠금)'],
  ['KD15k', 'KD15', '구별: 슬롯에 닿지 않는 매개변수의 증감은 무관', '0/0/-', `function run(n, ms) { n++; setTimeout(f, ms) }\nrun(0, scaleMs(5000))`, '설계자 전수(과잉 판정 잠금)'],
  ['KD15l', 'KD15', '구별: 슬롯에 닿지 않는 구조 분해 요소의 증감은 무관', '0/0/-', `let { a, ms } = { a: 0, ms: scaleMs(500) }\na++\nsetTimeout(f, ms)`, '설계자 전수(과잉 판정 잠금)'],
  // for-of·for-in 머리의 대입 대상(선언 아님) — 구조 분해 대입과 같은 칸
  ['KD15m', 'KD15', 'for-of 머리 구조 분해 대입 대상', '1/1/KD15', `let ms = 500\nfor ({ ms } of [{ ms: 5000 }]) {}\nsetTimeout(f, ms)`, 'verify r5 R4 (D11)'],
  ['KD15n', 'KD15', 'for-of 머리 식별자 대입 대상', '1/1/KD15', `let ms = 500\nfor (ms of [5000]) {}\nsetTimeout(f, ms)`, '설계자 전수(R4 형제)'],
  ['KD15o', 'KD15', 'for-in 머리 식별자 대입 대상', '1/1/KD15', `let ms = 500\nfor (ms in {}) {}\nsetTimeout(f, ms)`, '설계자 전수(R4 형제)'],
  ['KM11e', 'KM11', 'for-of 머리 멤버 대입 대상', '1/1/KM11', `const o = { ms: 500 }\nfor (o.ms of [5000]) {}\nsetTimeout(f, o.ms)`, '설계자 전수(R4 형제)'],
  ['KD15p', 'KD15', '구별: for-of 머리 대입 대상이 슬롯에 닿지 않음', '0/0/-', `let x = 0\nfor (x of [1]) {}\nsetTimeout(f, scaleMs(5000))`, '설계자 전수(과잉 판정 잠금)'],
  // 원천 사슬 — KD15 변수를 원천으로 쓰는 멤버 읽기는 원천 없음(KM08)
  ['KM08b', 'KM08', '구조 분해 대입 대상 변수의 멤버 읽기', '1/1/KM08', `let o = { ms: 500 }\n;({ o } = { o: { ms: 5000 } })\nsetTimeout(f, o.ms)`, '설계자 전수(D11 원천 사슬)'],
  ['KM08c', 'KM08', '나머지 요소 구조 분해 대입 대상의 멤버 읽기 → KM08(칸 ID는 KD15 아님)', '1/1/KM08', `let rest\n;({ ...rest } = { ms: 5000 })\nsetTimeout(f, rest.ms)`, 'verify r5 R19'],
  ['KM08d', 'KM08', '나머지 요소 선언의 멤버 읽기 → KM08', '1/1/KM08', `const o = { ms: 500 }\nconst { ...rest } = o\nsetTimeout(f, rest.ms)`, '설계자 전수(R19 형제)'],
  ['KM10n', 'KM10', '매개변수 대입 우변이 원천 사슬에 든다', '1/0/-', `function run(o) { o = { ms: 5000 }; setTimeout(f, o.ms) }\nrun({ ms: 500 })`, '설계자 전수(D11 원천 사슬)'],
  // 판정 순서 — 모든 이름 바인딩에서 KD13 → KD04 → KD03b → KD02 → KD15 → 값 칸
  ['KD13b', 'KD13', 'catch 구조 분해 요소의 증감 → KD13 우선', '1/1/KD13', `try { run() } catch ({ ms }) { ms++; setTimeout(f, ms) }`, '설계자 전수(순서)'],
  ['KD04b', 'KD04', 'for-of 구조 분해 요소의 복합 대입 → KD04 우선', '1/1/KD04', `for (let { ms } of [{ ms: 1 }]) { ms += 5000; setTimeout(f, ms) }`, '설계자 전수(순서)'],
  ['KD02d', 'KD02', '매개변수 복합 + 증감 → KD02 우선', '1/1/KD02', `function run(ms) { ms += 1; ms++; setTimeout(f, ms) }\nrun(500)`, '설계자 전수(순서)'],
]

let mismatch = 0
for (const [id, cell, rule, expected, code, src] of C) {
  let got
  try {
    got = vc(code)
  } catch (error) {
    got = `ERR ${String(error.message).split('\n')[0]}`
  }
  const ok = String(got) === String(expected)
  if (!ok) mismatch++
  if (onlyMismatch && ok) continue
  console.log(`${id}\t${cell}\t${rule}\t기대 ${expected}\t현재 ${got}\t${ok ? 'ok' : '판정'}\t${src}`)
}
console.error(`칸 입력 ${C.length} · 판정 불일치 ${mismatch}`)
