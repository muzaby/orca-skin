// 0294 ΔV5 — verify r4 D7(KD05 원천 멤버 입력 칸) · D8(창 안 확장 채택: 멤버 대입 KM10·KM11 · 변수 증감/구조 분해 대입 KD15)의
// 칸 입력과 기대. 판정 기대의 정본은 plan §7-F 표이고 이 파일은 그 입력의 실행본이다. dv3-branches.mjs · dv4-cells.mjs 와 함께 돈다.
// 사용: node dv5-cells.mjs <app 디렉토리> [--only-mismatch]
// 측정 vu = `위반 수/판정 불가 수`(analyzeScale, 의미 값·허용 항목 없음)
//      vc = `위반 수/판정 불가 수/판정 불가 칸 ID(정렬, 쉼표)` — 판정 불가 자리가 어느 칸으로 보고되는지까지 잠근다.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const appDir = resolve(process.argv[2] ?? '.')
const onlyMismatch = process.argv.includes('--only-mismatch')
const { analyzeScale } = await import(pathToFileURL(`${appDir}/scripts/check-test-budgets.mjs`).href)
const lines = (code) => analyzeScale('a.test.ts', code, [], [])
const vu = (code) => {
  const out = lines(code)
  return `${out.length}/${out.filter((l) => l.includes('판정 불가')).length}`
}
const vc = (code) => {
  const out = lines(code)
  const red = out.filter((l) => l.includes('판정 불가'))
  const ids = red.map((l) => (l.match(/판정 불가 ([A-Z]{2}\d+[a-z]?)/) ?? [, '?'])[1]).sort()
  return `${out.length}/${red.length}/${ids.join(',') || '-'}`
}

const IMP = (name) => `import { ${name} } from './o'\n`
// [ID, 칸, 규칙 조각, 기대, 소스, 측정, 출처]
const C = [
  // KD05 — 구조 분해: 후보가 없으면 원천 식을 KM 표로(객체·배열 리터럴 KM01~KM05 · 경계 KM07 · 그 밖 KM08), 원천 식이 없는 선언은 그 자리 칸
  ['KD05b', 'KD05', '원천 = 호출 결과 → KM08', '1/1/KM08', `${IMP('getOpts')}const { ms } = getOpts()\nsetTimeout(f, ms)`, vc, 'verify r4 Q1'],
  ['KD05c', 'KD05', '원천 = await 식 → KM08', '1/1/KM08', `${IMP('load')}const { ms } = await load()\nsetTimeout(f, ms)`, vc, 'verify r4 Q3'],
  ['KD05d', 'KD05·KD04', 'for-of 구조 분해 변수 → KD04', '1/1/KD04', `const cases = [{ ms: 5000 }]\nfor (const { ms } of cases) setTimeout(f, ms)`, vc, 'verify r4 Q2'],
  ['KD05e', 'KD05', '배열 패턴 · 원천 = 호출 결과 → KM08', '1/1/KM08', `${IMP('pair')}const [ms] = pair()\nsetTimeout(f, ms)`, vc, 'verify r4 Q4'],
  ['KD05f', 'KD05', '원천 = import → KM07 경계', '0/0/-', `${IMP('cfg')}const { ms } = cfg\nsetTimeout(f, ms)`, vc, '설계자 전수'],
  ['KD05g', 'KD05', '원천 = 키 없는 객체 리터럴 → KM02 숫자 아님', '0/0/-', `const { ms } = {}\nsetTimeout(f, ms)`, vc, '설계자 전수'],
  ['KD05h', 'KD05·KD13', 'catch 구조 분해 변수 → KD13', '1/1/KD13', `try { run() } catch ({ ms }) { setTimeout(f, ms) }`, vc, '설계자 전수'],
  ['KD05i', 'KD05', '매개변수 구조 분해 · 같은 파일 호출 인자 = 호출 결과 → KM08', '1/1/KM08', `${IMP('getOpts')}function run({ ms }) { setTimeout(f, ms) }\nrun(getOpts())`, vc, '설계자 전수'],
  ['KD05j', 'KD05', '매개변수 구조 분해 · 같은 파일 호출 인자 = 객체 리터럴(대조)', '1/0/-', `function run({ ms }) { setTimeout(f, ms) }\nrun({ ms: 5000 })`, vc, '설계자 전수'],
  ['KD05k', 'KD05', '원천 = 배율 객체 리터럴(대조)', '0/0/-', `const { ms } = { ms: scaleMs(5000) }\nsetTimeout(f, ms)`, vc, 'verify r4 Q6'],
  // KD15 — 변수: 증감(++ --) 또는 구조 분해 대입 대상 → red
  ['KD15a', 'KD15', '후위 증감이 있는 변수', '1/1/KD15', `let ms = 500\nms++\nsetTimeout(f, ms)`, vc, '설계자 전수(KD02 형제)'],
  ['KD15b', 'KD15', '전위 감소가 있는 변수', '1/1/KD15', `let ms = scaleMs(5000)\n--ms\nsetTimeout(f, ms)`, vc, '설계자 전수'],
  ['KD15c', 'KD15', '객체 구조 분해 대입 대상', '1/1/KD15', `let ms = 500\n;({ ms } = { ms: 5000 })\nsetTimeout(f, ms)`, vc, 'verify r4 Q9'],
  ['KD15d', 'KD15', '배열 구조 분해 대입 대상', '1/1/KD15', `let ms = 500\n;[ms] = [5000]\nsetTimeout(f, ms)`, vc, '설계자 전수'],
  ['KD15e', 'KD15', '이름 바꾼 구조 분해 대입 대상', '1/1/KD15', `let ms = 500\n;({ delay: ms } = { delay: 5000 })\nsetTimeout(f, ms)`, vc, '설계자 전수'],
  ['KD15f', 'KD15', '슬롯에 닿지 않는 변수의 증감은 무관(구별 입력)', '0/0/-', `let n = 0\nn++\nsetTimeout(f, scaleMs(5000))`, vc, '설계자 전수'],
  ['KD15g', 'KD15·KD02', '복합 대입은 KD02 그대로(형제 칸 구별)', '1/1/KD02', `let ms = 500\nms += 4500\nsetTimeout(f, ms)`, vc, 'ΔV4 KD02'],
  // KM10 — this.이름 · 객체 리터럴 원천의 멤버: 같은 파일 대입 = ??= ||= 의 우변을 후보에 더한다
  ['KM10a', 'KM10', 'this 멤버 — 생성자 대입(초기값 500)', '1/0/-', `class A { ms = 500; constructor() { this.ms = 5000 } run() { setTimeout(f, this.ms) } }`, vc, 'verify r4 Q8'],
  ['KM10b', 'KM10', 'this 멤버 — 초기값·대입 모두 배율', '0/0/-', `class A { ms = scaleMs(500); constructor() { this.ms = scaleMs(5000) } run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  ['KM10c', 'KM10', 'this 멤버 — 초기값 없는 선언 + 대입', '1/0/-', `class A { ms: number; constructor() { this.ms = 5000 } run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  ['KM10d', 'KM10', 'this 멤버 — 화살표 안 대입(같은 this)', '1/0/-', `class A { ms = 500; init() { const g = () => { this.ms = 5000 }; g() } run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  ['KM10e', 'KM10', 'this 멤버 — 다른 클래스의 대입은 후보 아님(구별 입력)', '0/0/-', `class B { ms = 0; run() { this.ms = 5000 } }\nclass A { ms = 500; run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  ['KM10f', 'KM10', '객체 멤버 — 속성 대입', '1/0/-', `const o = { ms: 500 }\no.ms = 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수(Q8 형제)'],
  ['KM10g', 'KM10', '객체 멤버 — 리터럴 키 요소 대입', '1/0/-', `const o = { ms: 500 }\no['ms'] = 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10h', 'KM10', '객체 멤버 — ??= 대입', '1/0/-', `const o = { ms: 500 }\no.ms ??= 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10i', 'KM10', '객체 멤버 — 별칭 변수로 대입', '1/0/-', `const o = { ms: 500 }\nconst a = o\na.ms = 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10j', 'KM10', '객체 멤버 — 같은 파일 함수 매개변수로 대입', '1/0/-', `const o = { ms: 500 }\nfunction set(x) { x.ms = 5000 }\nset(o)\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10k', 'KM10', '객체 멤버 — 배율 대입', '0/0/-', `const o = { ms: scaleMs(500) }\no.ms = scaleMs(5000)\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10l', 'KM10', '객체 멤버 — 다른 객체의 같은 키 대입은 후보 아님(구별 입력)', '0/0/-', `const o = { ms: scaleMs(500) }\nconst p = { ms: 1 }\np.ms = 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM10m', 'KM10', '객체 멤버 — 같은 객체의 다른 키 대입은 후보 아님(구별 입력)', '0/0/-', `const o = { ms: scaleMs(500), other: 0 }\no.other = 5000\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  // KM11 — 같은 대상의 복합 대입 · 증감 · 구조 분해 대입 대상 → red
  ['KM11a', 'KM11', 'this 멤버 복합 대입', '1/1/KM11', `class A { ms = 500; bump() { this.ms += 4500 } run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  ['KM11b', 'KM11', '객체 멤버 증감', '1/1/KM11', `const o = { ms: scaleMs(500) }\no.ms++\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM11c', 'KM11', '객체 멤버 구조 분해 대입 대상', '1/1/KM11', `const o = { ms: 500 }\n;({ delay: o.ms } = { delay: 5000 })\nsetTimeout(f, o.ms)`, vc, '설계자 전수'],
  ['KM11d', 'KM11', 'this 멤버 구조 분해 대입 대상', '1/1/KM11', `class A { ms = 500; set(s) { ;({ ms: this.ms } = s) } run() { setTimeout(f, this.ms) } }`, vc, '설계자 전수'],
  // 기존 칸 유지 대조
  ['KM06d', 'KM06', 'this 멤버 — 선언·대입 모두 없음 → KM06 그대로', '1/1/KM06', `class A { run() { setTimeout(f, this.ms) } }`, vc, 'ΔV4 KM06c'],
  ['KM01b', 'KM01', '객체 멤버 — 대입 없음 → KM01 그대로', '1/0/-', `const o = { ms: 5000 }\nsetTimeout(f, o.ms)`, vc, 'ΔV4 KM01'],
]

let mismatch = 0
for (const [id, cell, rule, expected, code, measure, src] of C) {
  let got
  try {
    got = measure(code)
  } catch (error) {
    got = `ERR ${String(error.message).split('\n')[0]}`
  }
  const ok = String(got) === String(expected)
  if (!ok) mismatch++
  if (onlyMismatch && ok) continue
  console.log(`${id}\t${cell}\t${rule}\t기대 ${expected}\t현재 ${got}\t${ok ? 'ok' : '판정'}\t${src}`)
}
console.error(`칸 입력 ${C.length} · 판정 불일치 ${mismatch}`)
