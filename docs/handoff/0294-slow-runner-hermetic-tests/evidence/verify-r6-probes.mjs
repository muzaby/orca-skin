// verify r6 독립 축(⑥) 탐침 — 411행 입력·r5 탐침 밖. 사용: node verify-r6-probes.mjs <appDir>
// 축 A(대칭): D-020 "구조 분해 값 = 같은 원천의 멤버 읽기 판정" — 원천 형태 N종마다 구조 분해 읽기와 멤버 읽기의 vc 가 같은가.
// 축 B(순서·소유): 이름 바인딩 판정 순서와 소유 대조 — 가림(shadow)·형제 함수·형제 패턴 요소.
// 축 C(재진입·상한): 순환 원천·깊은 사슬에서 예외·지연이 없는가.
// 축 D(for 머리 대입 문법): 식별자 외 래퍼·멤버·패턴·for await.
// 측정 vc = 위반 수/판정 불가 수/판정 불가 칸 ID (dv6-cells.mjs 와 같은 측정)
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
const app = resolve(process.argv[2] ?? '.')
const { analyzeScale } = await import(pathToFileURL(join(app, 'scripts/check-test-budgets.mjs')).href)
const measure = (code) => {
  const out = analyzeScale('a.test.ts', code, [], [])
  const red = out.filter((l) => l.includes('판정 불가'))
  const ids = red.map((l) => (l.match(/판정 불가 ([A-Z]{2}\d+[a-z]?)/) ?? [, '?'])[1]).sort()
  return { n: out.length, u: red.length, ids: ids.join(',') || '-' }
}
const vc = (code) => {
  const m = measure(code)
  return `${m.n}/${m.u}/${m.ids}`
}
const IMP = (n) => `import { ${n} } from './o'\n`
let mismatch = 0
let total = 0

// ── 축 A: 대칭 쌍 — [id, 원천 설명, 선언부(prelude), 구조 분해 읽기 소스, 멤버 읽기 소스]
const T = (read) => `setTimeout(f, ${read})`
const pairs = [
  ['A01', '같은 파일 함수 반환 리터럴', `function opts() { return { ms: 500 } }\n`, `const { ms } = opts()\n${T('ms')}`, T('opts().ms')],
  ['A02', '같은 파일 함수 반환 scaleMs', `function opts() { return { ms: scaleMs(500) } }\n`, `const { ms } = opts()\n${T('ms')}`, T('opts().ms')],
  ['A03', '같은 파일 함수 반환 조건식(리터럴 | import 호출)', `${IMP('ext')}function opts() { return cond ? { ms: 500 } : ext() }\n`, `const { ms } = opts()\n${T('ms')}`, T('opts().ms')],
  ['A04', 'IIFE 반환', ``, `const { ms } = (() => ({ ms: 500 }))()\n${T('ms')}`, T('(() => ({ ms: 500 }))().ms')],
  ['A05', 'await 식', ``, `const { ms } = await load()\n${T('ms')}`, T('(await load()).ms')],
  ['A06', '중첩 키 + 멤버 대입(r.a 에 리터럴 대입)', `const r = { a: { ms: scaleMs(500) } }\nr.a = { ms: 5000 }\n`, `const { a: { ms } } = r\n${T('ms')}`, T('r.a.ms')],
  ['A07', '중첩 멤버 대입(r.a.ms = 5000)', `const r = { a: { ms: scaleMs(500) } }\nr.a.ms = 5000\n`, `const { a: { ms } } = r\n${T('ms')}`, T('r.a.ms')],
  ['A08', '중첩 멤버 증감(r.a.ms++)', `const r = { a: { ms: scaleMs(500) } }\nr.a.ms++\n`, `const { a: { ms } } = r\n${T('ms')}`, T('r.a.ms')],
  ['A09', '배열 원천 + 요소 대입', `const arr = [scaleMs(500)]\narr[0] = 5000\n`, `const [ms] = arr\n${T('ms')}`, T('arr[0]')],
  ['A10', '배열 원천 + 요소 증감', `const arr = [scaleMs(500)]\narr[0]++\n`, `const [ms] = arr\n${T('ms')}`, T('arr[0]')],
  ['A11', '배열 원천 둘째 요소', `const arr = [scaleMs(500), 5000]\n`, `const [, ms] = arr\n${T('ms')}`, T('arr[1]')],
  ['A12', '객체 전개 원천(리터럴 전개)', `const base = { ms: 500 }\nconst o = { ...base }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A13', '객체 전개 원천(호출 전개)', `${IMP('ext')}const o = { ...ext() }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A14', '?? 원천(리터럴 ?? 호출)', `${IMP('ext')}const o = ext() ?? { ms: 500 }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A15', '&& 원천', `${IMP('ext')}const o = ext() && { ms: 500 }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A16', 'as const 래퍼 원천', ``, `const { ms } = { ms: 500 } as const\n${T('ms')}`, T('({ ms: 500 } as const).ms')],
  ['A17', 'satisfies 래퍼 원천', ``, `const { ms } = { ms: 500 } satisfies { ms: number }\n${T('ms')}`, T('({ ms: 500 } satisfies { ms: number }).ms')],
  ['A18', '문자열 키', `const o = { ms: 500 }\n`, `const { 'ms': x } = o\n${T('x')}`, T("o['ms']")],
  ['A19', '숫자 키', `const o = { 0: 500 }\n`, `const { 0: x } = o\n${T('x')}`, T('o[0]')],
  ['A20', '계산 키(문자열 리터럴)', `const o = { ms: 500 }\n`, `const { ['ms']: x } = o\n${T('x')}`, T("o['ms']")],
  ['A21', '계산 키(변수)', `const k = 'ms'\nconst o = { ms: 500 }\n`, `const { [k]: x } = o\n${T('x')}`, T('o[k]')],
  ['A22', '키가 원천에 없음', `const o = { other: 500 }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A23', '호출 반환 변수', `${IMP('ext')}const o = ext()\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A24', 'import 멤버 원천', `${IMP('cfg')}`, `const { ms } = cfg.opts\n${T('ms')}`, T('cfg.opts.ms')],
  ['A25', 'lib 전역 원천', ``, `const { ms } = process.env\n${T('ms')}`, T('process.env.ms')],
  ['A26', '매개변수 원천 — 호출 둘(리터럴 · 호출)', `${IMP('ext')}function run(o) { __BODY__ }\nrun({ ms: scaleMs(500) })\nrun(ext())\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A27', '매개변수 원천 — 호출부 없음', `function run(o) { __BODY__ }\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A28', '구조 분해 매개변수 vs 멤버 읽기 — 호출 인자 리터럴', `__PARAM__`, ``, ``],
  ['A29', 'this 필드 원천', `class A { o = { ms: 500 }; run() { __BODY__ } }\n`, `const { ms } = this.o\n${T('ms')}`, T('this.o.ms')],
  ['A30', 'this 필드 원천 + 생성자 대입', `class A { o = { ms: scaleMs(500) }; constructor() { this.o = { ms: 5000 } } run() { __BODY__ } }\n`, `const { ms } = this.o\n${T('ms')}`, T('this.o.ms')],
  ['A31', 'for-of 요소 원천', ``, `for (const e of xs) { const { ms } = e; ${T('ms')} }`, `for (const e of xs) { ${T('e.ms')} }`],
  ['A32', 'catch 변수 원천', ``, `try {} catch (e) { const { ms } = e; ${T('ms')} }`, `try {} catch (e) { ${T('e.ms')} }`],
  ['A33', '원천 변수 재대입(호출) 뒤 읽기', `${IMP('ext')}let o = { ms: scaleMs(500) }\no = ext()\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A34', '원천 변수 증감 대상(KD15)', `let o = { ms: scaleMs(500) }\no++\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A35', '원천 변수 복합 대입(KD02)', `let o = { ms: scaleMs(500) }\no += 1\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A36', '원천 구조 분해 대입 대상(KD15)', `let o = { ms: scaleMs(500) }\n;({ o } = { o: 1 })\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A37', '원천 for-of 머리 대입 대상', `let o = { ms: scaleMs(500) }\nfor (o of xs) {}\n`, `const { ms } = o\n${T('ms')}`, T('o.ms')],
  ['A38', '선택적 연쇄 읽기', `const o = { a: { ms: 500 } }\n`, `const { ms } = o.a\n${T('ms')}`, T('o?.a?.ms')],
  ['A39', '기본값 + 원천에 키 없음', `const o = { other: 1 }\n`, `const { ms = 500 } = o\n${T('ms')}`, T('o.ms ?? 500')],
  ['A40', '기본값 + 원천 키 scaleMs', `const o = { ms: scaleMs(500) }\n`, `const { ms = 5000 } = o\n${T('ms')}`, T('o.ms ?? 5000')]
]
const expand = (p) => {
  const [id, desc, pre, a, b] = pairs.find((x) => x[0] === p) ?? []
  return { id, desc, pre, a, b }
}
for (const [id, desc, pre, a, b] of pairs) {
  if (id === 'A28') continue
  const fill = (s) => s.replaceAll('__BODY__', '')
  let codeA
  let codeB
  if (pre.includes('__BODY__')) {
    codeA = pre.replaceAll('__BODY__', a)
    codeB = pre.replaceAll('__BODY__', b)
  } else {
    codeA = `${fill(pre)}${a}`
    codeB = `${fill(pre)}${b}`
  }
  const va = vc(codeA)
  const vb = vc(codeB)
  total++
  const same = va === vb
  // 판정 불가 칸 ID 는 읽기 형태마다 달라도 되고(KD05 경로 대 KM 경로), 위반 수·판정 불가 수가 같아야 한다.
  const ma = measure(codeA)
  const mb = measure(codeB)
  const sameCount = ma.n === mb.n && ma.u === mb.u
  if (!sameCount) mismatch++
  console.log(`${id}\t${desc}\t구조 분해 ${va}\t멤버 ${vb}\t${sameCount ? (same ? 'ok' : 'ok(칸 ID 다름)') : 'ASYMMETRIC'}`)
}
// A28 — 구조 분해 매개변수: 호출 인자가 리터럴 / 호출
{
  const a = `function run({ ms }) { ${T('ms')} }\nrun({ ms: 500 })`
  const b = `function run(o) { ${T('o.ms')} }\nrun({ ms: 500 })`
  const va = vc(a)
  const vb = vc(b)
  total++
  const ma = measure(a)
  const mb = measure(b)
  const ok = ma.n === mb.n && ma.u === mb.u
  if (!ok) mismatch++
  console.log(`A28\t구조 분해 매개변수 · 호출 인자 리터럴\t구조 분해 ${va}\t멤버 ${vb}\t${ok ? 'ok' : 'ASYMMETRIC'}`)
}
{
  const a = `${IMP('ext')}function run({ ms }) { ${T('ms')} }\nrun(ext())`
  const b = `${IMP('ext')}function run(o) { ${T('o.ms')} }\nrun(ext())`
  const va = vc(a)
  const vb = vc(b)
  total++
  const ma = measure(a)
  const mb = measure(b)
  const ok = ma.n === mb.n && ma.u === mb.u
  if (!ok) mismatch++
  console.log(`A28b\t구조 분해 매개변수 · 호출 인자 호출\t구조 분해 ${va}\t멤버 ${vb}\t${ok ? 'ok' : 'ASYMMETRIC'}`)
}

// ── 축 B/D: 단일 기대 — [id, 근거, 소스, 기대 vc]
const rows = [
  ['B01', '가림: 안쪽 블록의 ms++ 는 바깥 매개변수와 무관', `function run(ms) { { let ms = 1; ms++ } setTimeout(f, ms) }\nrun(scaleMs(500))`, '0/0/-'],
  ['B02', '형제 함수의 같은 이름 매개변수 증감은 무관', `function a(ms) { ms++ }\nfunction b(ms) { setTimeout(f, ms) }\nb(scaleMs(500))`, '0/0/-'],
  ['B03', '형제 구조 분해 요소의 증감은 무관', `function run({ a, b }) { a++; setTimeout(f, b) }\nrun({ a: 1, b: scaleMs(500) })`, '0/0/-'],
  ['B04', '구조 분해 선언의 한 요소만 증감 — 다른 요소는 무관', `const { a, b } = { a: 1, b: scaleMs(500) }\nlet { c } = { c: 1 }\nc++\nsetTimeout(f, b)`, '0/0/-'],
  ['B05', '같은 이름 중첩 요소 — 안쪽만 증감', `const { x: { ms } } = { x: { ms: scaleMs(500) } }\n{ let { ms } = { ms: 1 }; ms++ }\nsetTimeout(f, ms)`, '0/0/-'],
  ['B06', '화살표 콜백 매개변수 증감 → KD15', `xs.forEach((ms) => { ms++; setTimeout(f, ms) })`, '1/1/KD15'],
  ['B07', '메서드 매개변수 증감(호출부 있음) → KD15', `class A { run(ms) { ms++; setTimeout(f, ms) } }\nnew A().run(500)`, '1/1/KD15'],
  ['B08', '매개변수 기본값 + 본문 대입 — 후보 둘', `function run(ms = 500) { ms = 5000; setTimeout(f, ms) }\nrun()`, '1/0/-'],
  ['B09', '매개변수 기본값 scaleMs + 본문 대입 리터럴 → 대입 후보가 위반', `function run(ms = scaleMs(500)) { ms = 5000; setTimeout(f, ms) }\nrun()`, '1/0/-'],
  ['B10', '구조 분해 매개변수 기본값 + 본문 대입 리터럴', `function run({ ms = scaleMs(500) }) { ms = 5000; setTimeout(f, ms) }\nrun({})`, '1/0/-'],
  ['B11', 'catch 구조 분해의 기본값 → KD13', `try {} catch ({ ms = 500 }) { setTimeout(f, ms) }`, '1/1/KD13'],
  ['B12', 'for-of 구조 분해의 기본값 → KD04', `for (const { ms = 500 } of xs) setTimeout(f, ms)`, '1/1/KD04'],
  ['B13', 'for-in 변수 → KD04', `for (const ms in o) setTimeout(f, ms)`, '1/1/KD04'],
  ['B14', 'declare 구조 분해 → KD03b(bound)', `declare const { ms }: { ms: number }\nsetTimeout(f, ms)`, '0/0/-'],
  ['B15', '증감 대상 + 복합 대상 동시 → KD02 먼저', `let ms = 500\nms += 1\nms++\nsetTimeout(f, ms)`, '1/1/KD02'],
  ['B16', '구조 분해 요소 복합 + 증감 → KD02 먼저', `let { ms } = { ms: 500 }\nms += 1\nms++\nsetTimeout(f, ms)`, '1/1/KD02'],
  ['B17', '매개변수 구조 분해 요소 복합 + 증감 → KD02 먼저', `function run({ ms }) { ms += 1; ms++; setTimeout(f, ms) }\nrun({ ms: 500 })`, '1/1/KD02'],
  ['B18', '구조 분해 대입의 기본값 있는 변수 대상 → KD15', `let ms = scaleMs(500)\n;[ms = 1] = []\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['B19', '구조 분해 대입의 중첩 대상 → KD15', `let ms = scaleMs(500)\n;({ a: { b: ms } } = o)\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['B20', '구조 분해 대입의 나머지 요소 대상 → KD15', `let ms = scaleMs(500)\n;[...ms] = xs\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D01', 'for-of 머리: 괄호 식별자 대입', `let ms = scaleMs(500)\nfor ((ms) of xs) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D02', 'for-of 머리: as 래퍼 식별자 대입', `let ms: any = scaleMs(500)\nfor ((ms as any) of xs) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D03', 'for-of 머리: 비-null 단언 식별자 대입', `let ms: any = scaleMs(500)\nfor (ms! of xs) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D04', 'for-await 머리: 식별자 대입', `async function g() { let ms = scaleMs(500); for await (ms of xs) {} setTimeout(f, ms) }`, '1/1/KD15'],
  ['D05', 'for-in 머리: 식별자 대입', `let ms = scaleMs(500)\nfor (ms in o) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D06', 'for-in 머리: 구조 분해 대입은 문법 오류지만 패턴 변수는 표시', `let ms = scaleMs(500)\nfor ([ms] in o) {}\nsetTimeout(f, ms)`, '1/1/KD15'],
  ['D07', 'for-of 머리: 멤버 대입 대상 → KM11', `const o = { ms: scaleMs(500) }\nfor (o.ms of xs) {}\nsetTimeout(f, o.ms)`, '1/1/KM11'],
  ['D08', 'for-of 머리: 요소 접근 대상 → KM11', `const o = { ms: scaleMs(500) }\nfor (o['ms'] of xs) {}\nsetTimeout(f, o.ms)`, '1/1/KM11'],
  ['D09', 'for-of 머리: this 멤버 대상 → KM11', `class A { ms = scaleMs(500); run() { for (this.ms of xs) {} setTimeout(f, this.ms) } }`, '1/1/KM11'],
  ['D10', 'for-of 머리: 중첩 멤버 대상 → KM11', `const o = { a: { ms: scaleMs(500) } }\nfor (o.a.ms of xs) {}\nsetTimeout(f, o.a.ms)`, '1/1/KM11'],
  ['D11', 'for-of 머리: 선언(const)은 대입이 아니다 — 무관 변수', `let ms = scaleMs(500)\nfor (const x of xs) {}\nsetTimeout(f, ms)`, '0/0/-'],
  ['D12', 'for-of 머리: 같은 이름 선언은 바깥 변수를 가린다', `let ms = scaleMs(500)\nfor (let ms of xs) {}\nsetTimeout(f, ms)`, '0/0/-'],
  ['D13', 'for 문 초기식 대입(for-of 아님) 대상 → KD15 아님(대입 `=` 은 후보)', `let ms\nfor (ms = 500; ms < 600; ms += 1) {}\nsetTimeout(f, ms)`, '1/1/KD02']
]
for (const [id, why, src, want] of rows) {
  const got = vc(src)
  total++
  const ok = got === want
  if (!ok) mismatch++
  console.log(`${id}\t${why}\t기대 ${want}\t현재 ${got}\t${ok ? 'ok' : 'MISMATCH'}`)
}

// ── 축 C: 재진입·상한
const cyc = [
  ['C01', '상호 재귀 구조 분해 매개변수', `function a({ x }) { b({ x }); setTimeout(f, x) }\nfunction b({ x }) { a({ x }) }\na({ x: 500 })`],
  ['C02', '상호 재귀 멤버 읽기 매개변수', `function a(o) { b(o); setTimeout(f, o.ms) }\nfunction b(o) { a(o.next) }\na({ ms: 500, next: {} })`],
  ['C03', '자기 참조 객체 원천', `const o = { ms: 500 }\no.self = o\nconst { self: { self: { ms } } } = o\nsetTimeout(f, ms)`],
  ['C04', '순환 대입 구조 분해', `let a = { v: 1 }\nlet b = { v: 2 }\n;({ v: a } = b)\n;({ v: b } = a)\nconst { v } = a\nsetTimeout(f, v)`],
  ['C05', '재귀 함수 반환 구조 분해', `function g(n) { const { ms } = n ? g(n - 1) : { ms: 500 }; return { ms } }\nconst { ms } = g(3)\nsetTimeout(f, ms)`],
  ['C06', 'for 머리 자기 참조 대입', `let o = { o: null }\nfor (o of [o]) {}\nconst { o: p } = o\nsetTimeout(f, p)`]
]
for (const [id, why, src] of cyc) {
  const t0 = Date.now()
  let got
  try {
    got = vc(src)
  } catch (e) {
    got = `EXC ${e.message.slice(0, 60)}`
  }
  const ms = Date.now() - t0
  total++
  const ok = !got.startsWith('EXC') && ms < 2000
  if (!ok) mismatch++
  console.log(`${id}\t${why}\t현재 ${got}\t${ms}ms\t${ok ? 'ok' : 'MISMATCH'}`)
}
// 깊은 사슬 — 구조 분해 N 단계, 매개변수 호출 사슬 N 단계의 시간
for (const n of [50, 200, 800]) {
  let code = `const d0 = { ms: scaleMs(500) }\n`
  for (let i = 1; i <= n; i++) code += `const { ms: m${i} } = { ms: d${i - 1}.ms }\nconst d${i} = { ms: m${i} }\n`
  code += `setTimeout(f, d${n}.ms)`
  const t0 = Date.now()
  let got
  try {
    got = vc(code)
  } catch (e) {
    got = `EXC ${e.message.slice(0, 60)}`
  }
  const ms = Date.now() - t0
  total++
  console.log(`C-deep${n}\t구조 분해 사슬 ${n}단\t현재 ${got}\t${ms}ms\t${ms < 5000 && !got.startsWith('EXC') ? 'ok' : 'SLOW'}`)
}
for (const n of [50, 200]) {
  let code = ''
  for (let i = 0; i < n; i++) code += `function p${i}({ ms }) { ${i + 1 < n ? `p${i + 1}({ ms })` : 'setTimeout(f, ms)'} }\n`
  code += `p0({ ms: scaleMs(500) })`
  const t0 = Date.now()
  let got
  try {
    got = vc(code)
  } catch (e) {
    got = `EXC ${e.message.slice(0, 60)}`
  }
  const ms = Date.now() - t0
  total++
  console.log(`C-chain${n}\t구조 분해 매개변수 호출 사슬 ${n}단\t현재 ${got}\t${ms}ms\t${ms < 5000 && !got.startsWith('EXC') ? 'ok' : 'SLOW'}`)
}
console.log(`탐침 ${total} · 대칭/기대 불일치 ${mismatch}`)
void expand
