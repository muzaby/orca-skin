// 0294 ΔV3 — EP-12b 규칙 칸 분기 목록(분모)과 분기마다 UT 입력. 게이트 판정 함수에 문자열 소스를 넣어
// 현재 판정을 기대와 대조한다. 판정 기대의 정본은 plan §7-D 분기 목록이고 이 파일은 그 입력의 실행본이다.
// 사용: node dv3-branches.mjs <app 디렉토리> [--only-mismatch]
// 열: 분기 ID · 지점 · 규칙 원문 조각 · 기대 · 현재 · 일치(ok | 판정) · 기존 UT 케이스(없으면 '신설')
// 측정 v = analyzeScale(허용 항목 없음) 위반 수 · w = vi.waitFor 이중 배율 수 · d = deadline 자리 수(배율 포함)
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2] ?? '.')
const onlyMismatch = process.argv.includes('--only-mismatch')
const { analyzeScale, scanBudgetSites, listBudgetFiles, listTestFiles, analyze, runCli } = await import(
  pathToFileURL(`${appDir}/scripts/check-test-budgets.mjs`).href
)
const v = (code) => analyzeScale('a.test.ts', code, []).length
const w = (code) =>
  scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'waitFor').length
const d = (code) =>
  scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'deadline').length
// P6 — 허용 항목 {file:'a', value:'5000', count:2, reason:'r'} 아래 위반 수. 소스 = 자리 수 n 또는 '다른 파일'.
const ENTRY = { file: 'a', value: '5000', count: 2, reason: 'r' }
const sites = (n) => Array.from({ length: n }, () => 'setTimeout(f, 5000)').join('\n')
const a6 = ([file, code, entry]) => analyzeScale(file, code, [entry]).length
// P1 · P9 --report — 임시 트리
const withTree = (files, fn) => {
  const root = mkdtempSync(join(tmpdir(), 'dv3-'))
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), body)
    }
    return fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
const P1_TREE = {
  'src/a.test.ts': 'export const s = AbortSignal.timeout(5000)\n',
  'src/b.testfixture.ts': "export const s = AbortSignal.timeout(5000)\nawait execFile('git', ['init'])\n",
  'src/c.testfixture.tsx': 'export const s = AbortSignal.timeout(5000)\nexport const C = () => <div timeout={1} />\n',
  'src/d.ts': 'export const s = AbortSignal.timeout(5000)\n'
}
const p1 = (name) => withTree(P1_TREE, (root) => listBudgetFiles(join(root, 'src')).includes(name) ? 1 : 0)
const p1ae = () => withTree(P1_TREE, (root) => listTestFiles(join(root, 'src')).join(','))
const report = (col) =>
  withTree(
    { 'src/a.test.ts': 'const T = 30_000\nsetTimeout(f, T)\nsetTimeout(g, 2700)\n' },
    (root) => {
      const lines = []
      const [log, err] = [console.log, console.error]
      console.log = (line) => lines.push(line)
      console.error = () => {}
      try {
        runCli(root, ['--report'], [{ file: 'a.test.ts', value: '2700', count: 1, reason: 'r' }])
      } finally {
        console.log = log
        console.error = err
      }
      return lines
        .filter((l) => l.startsWith('deadline\t'))
        .map((l) => [].concat(col).map((c) => l.split('\t')[c]).join('|'))
        .join(' § ')
    }
  )

// [ID, 지점, 규칙 조각, 기대, 소스, 측정, 기존 UT]
// 기대는 규칙 원문 기준. 배율 대조가 의미 있는 분기는 같은 소스의 scaleMs 판본을 'ID·s' 로 둔다.
const SLEEP = 'const sleep = (ms) => new Promise((r) => setTimeout(r, ms))'
const B = [
  // P2′ 형태 — ΔV1 P2 7형태 + named
  ['F01', 'P2′', 'timer 전역 setTimeout 둘째 인자', 1, `setTimeout(f, 5000)`, v, "'P2 — timer 전역'"],
  ['F02', 'P2′', 'timer globalThis.', 1, `globalThis.setTimeout(f, 5000)`, v, "'P2 — timer globalThis'"],
  ['F03', 'P2′', 'timer window.', 1, `window.setTimeout(f, 5000)`, v, "'P2 — timer window'"],
  ['F04', 'P2′', 'timer timers/promises setTimeout 첫 인자 — 별칭 없음', 1, `import { setTimeout } from 'node:timers/promises'\nawait setTimeout(5000)`, v, '신설(W1)'],
  ['F04·s', 'P2′', '같음 — scaleMs', 0, `import { setTimeout } from 'node:timers/promises'\nawait setTimeout(scaleMs(5000))`, v, '신설(W1s)'],
  ['F05', 'P2′', 'timer timers/promises import 별칭', 1, `import { setTimeout as sleep } from 'node:timers/promises'\nawait sleep(5000)`, v, "'P2 — timer timers/promises'"],
  ['F06', 'P2′', 'method x.setTimeout(N)', 1, `socket.setTimeout(5000)`, v, "'P2 — method'"],
  ['F07', 'P2′', 'abort AbortSignal.timeout', 1, `const s = AbortSignal.timeout(5000)`, v, "'P2 — abort'"],
  ['F08', 'P2′', 'deadline now 식 + N', 1, `const d = Date.now() + 5000`, v, "'P2 — deadline now()+N'"],
  ['F09', 'P2′', 'deadline N + now 식', 1, `const d = 5000 + performance.now()`, v, "'P2 — deadline N+now()'"],
  ['F10', 'P2′', 'deadline 비교 < (now 왼쪽)', 1, `while (Date.now() - t < 5000) {}`, v, "'P2 — deadline <'"],
  ['F11', 'P2′', 'deadline 비교 <=', 1, `while (Date.now() - t <= 5000) {}`, v, "'P2 — deadline <='"],
  ['F12', 'P2′', 'deadline 비교 >', 1, `if (Date.now() - t > 5000) throw e`, v, "'P2 — deadline >'"],
  ['F13', 'P2′', 'deadline 비교 >= (now 오른쪽)', 1, `if (5000 >= Date.now() - t) ok()`, v, "'P2 — deadline >='"],
  ['F14', 'P2′·P8', 'deadline += N', 1, `let d = Date.now()\nd += 5000`, v, "'P8 += 마감'"],
  ['F15', 'P2′·P8', 'elapsed expect(now 식).toBeLessThan(N)', 1, `expect(Date.now() - start).toBeLessThan(5000)`, v, "'P2 — elapsed'"],
  ['F16', 'P2′·P8', 'elapsed toBeLessThanOrEqual', 1, `expect(performance.now() - s).toBeLessThanOrEqual(5000)`, v, "'P2 — elapsed OrEqual'"],
  ['F17', 'P2′·P8', 'elapsed 역방향 expect(N).toBeGreaterThan(now 식)', 1, `expect(5000).toBeGreaterThan(Date.now() - s)`, v, "'P8 역방향 상한 단언'"],
  ['F18', 'P2′·P8', 'elapsed 역방향 toBeGreaterThanOrEqual', 1, `expect(5000).toBeGreaterThanOrEqual(Date.now() - s)`, v, '신설(V-gte)'],
  ['F19', 'P2′', 'option /timeout/i 키', 1, `pool({ timeoutMs: 5000 })`, v, "'P2 — option 키'"],
  ['F20', 'P2′', 'option /timeout/i 이름 속성에 담긴 객체의 숫자 속성', 1, `pool({ timeouts: { connectMs: 5000 } })`, v, "'P2 — option 중첩 timeouts'"],
  ['F21', 'P2′', 'option /timeout/i 이름 변수에 담긴 객체', 1, `const timeouts = { commandMs: 5000 }`, v, "'P2 — option timeout 변수의 객체'"],
  ['F22', 'P2′', 'param /timeout/i 매개변수 기본값', 1, `function fixture(timeoutMs = 5000) {}`, v, "'P2 — param'"],
  ['F23', 'P2′', 'named 이름 변수 초기값', 1, `const timeoutMs = 5000\nawait waitUntil(s, timeoutMs)`, v, "'P2′ named 위치 인자로 넘김'"],
  ['F24', 'P2′', 'named 식별자 대입', 1, `let timeoutMs\ntimeoutMs = 5000\nawait waitUntil(s, timeoutMs)`, v, '신설(M21b)'],
  ['F25', 'P2′', '라벨 밖 이름은 자리 아님', 0, `pool({ delayMs: 5000 })\nfunction f(delayMs = 5000) {}`, v, "'P2 — 라벨 밖 이름(delayMs)'"],
  // P2′ 호출 대상 해석 — B1·B2·promisify(x)·util.promisify(x)·import 별칭
  ['C01', 'P2′', '호출 대상 B1 래퍼 ( )', 1, `;(setTimeout)(f, 5000)`, v, '신설(V-peel)'],
  ['C02', 'P2′', '호출 대상 B1 래퍼 as', 1, `;(setTimeout as typeof setTimeout)(f, 5000)`, v, '신설'],
  ['C03', 'P2′', '호출 대상 B2 변수 초기값(재대입 없음)', 1, `const st = setTimeout\nst(f, 5000)`, v, "'P2′ setTimeout 별칭'"],
  ['C05', 'P2′', '호출 대상 promisify(x)', 1, `import { execFile } from 'node:child_process'\nawait promisify(execFile)(c, a, { timeout: 10 })`, v, "'P4′ 자식 프로세스 …'"],
  ['C06', 'P2′', '호출 대상 util.promisify(x)', 1, `import util from 'node:util'\nimport { execFile } from 'node:child_process'\nawait util.promisify(execFile)(c, a, { timeout: 10 })`, v, '신설(V-util)'],
  ['C07', 'P2′', '호출 대상 child_process import 별칭', 1, `import { execFile as run } from 'node:child_process'\nrun(c, a, { timeout: 10 })`, v, "'P4′ 자식 프로세스 …'"],
  ['C08', 'P2′', '호출 대상 B2 별칭 AbortSignal.timeout', 1, `const t = AbortSignal.timeout\nt(5000)`, v, "'P2′ AbortSignal.timeout 별칭'"],
  // P2′ 슬롯
  ['S01', 'P2′', 'option 단축 속성(이름 변수가 아닌 매개변수 경유)', 1, `function run(timeoutMs) { return pool({ timeoutMs }) }\nrun(5000)`, v, "'P2′ 단축 속성 — 이름 변수가 아닌 매개변수 경유'"],
  ['S02', 'P2′', 'option 대입 o.k = v', 1, `socket.timeout = 5000`, v, "'P2′ 속성 대입'"],
  ['S03', 'P2′', "option 대입 o['k'] = v", 1, `o['timeoutMs'] = 5000`, v, '신설(V-elem)'],
  ['S04', 'P2′', 'option 대입 ??=', 1, `opts.timeoutMs ??= 5000`, v, "'P2′ ??= 대입'"],
  ['S05', 'P2′', 'option 대입 ||=', 1, `opts.timeoutMs ||= 5000`, v, '신설(V-oreq)'],
  ['S06', 'P2′', 'option 대입 — 소유 객체 이름이 /timeout/i', 1, `timeouts.connectMs = 5000`, v, "'P2′ timeouts 소유 객체 대입'"],
  ['S07', 'P2′', 'option 클래스 필드', 1, `class F { timeoutMs = 5000 }`, v, "'P2′ 클래스 필드'"],
  ['S08', 'P2′', '중첩 timeouts 소유 — 바인딩 참조(속성)', 1, `const t = { connectMs: 1000 }\npool({ timeouts: t })`, v, "'P2′ timeouts 소유는 바인딩 참조로도 본다'"],
  ['S08·n', 'P2′', '같음 — 라벨 밖 속성의 참조는 소유 아님', 0, `const t = { connectMs: 1000 }\npool({ other: t })`, v, "'P2′ timeouts 소유는 바인딩 참조로도 본다'"],
  ['S09', 'P2′', '중첩 timeouts 소유 — 바인딩 참조(단축 속성)', 1, `const t = { connectMs: 1000 }\nconst timeouts = t\npool({ timeouts })`, v, '신설'],
  ['S10', 'P2′', 'param 구조 분해 매개변수 기본값', 1, `const f = ({ timeoutMs = 5000 } = {}) => 0`, v, "'P2′ 구조 분해 매개변수 기본값 (Y11)'"],
  ['S11', 'P2′', 'param 구조 분해 변수 기본값', 1, `const { timeoutMs = 5000 } = o`, v, "'P2′ 구조 분해 변수 기본값'"],
  ['S12', 'P2′', 'param 이름 = 속성 이름 우선', 1, `function f({ timeout: t = 5000 } = {}) { return t }`, v, "'P2′ 이름 바꾼 구조 분해'"],
  ['S13', 'P2′', 'param 배열 구조 분해 기본값', 1, `const [timeoutMs = 5000] = l`, v, "'P2′ 배열 구조 분해 기본값'"],
  // P3′ 값 해석 B0~B7
  ['V01', 'P3′', 'B0 가림 — 리터럴 블록이 앞', 1, `it('b', () => { const t = 5000; setTimeout(f, t) })\nit('a', () => { const t = scaleMs(5000); setTimeout(f, t) })`, v, "'P3′ 가림 …'"],
  ['V02', 'P3′', 'B0 가림 — 리터럴 블록이 뒤', 1, `it('a', () => { const t = scaleMs(5000); setTimeout(f, t) })\nit('b', () => { const t = 5000; setTimeout(f, t) })`, v, "'P3′ 가림 …'"],
  ['V03', 'P3′', 'B1 래퍼 ( )·as', 1, `setTimeout(f, (5000 as number))`, v, "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"],
  ['V04', 'P3′', 'B2 변수 초기값', 1, `const T = 30_000\nsetTimeout(f, T)`, v, "'P3 — 같은 파일 const …'"],
  ['V05', 'P3′', 'B2 같은 파일 대입 =', 1, `let t = scaleMs(500)\nt = 5000\nsetTimeout(f, t)`, v, "'P3′ let 재대입 값도 후보다'"],
  ['V06', 'P3′', 'B2 같은 파일 대입 ??=', 1, `let t\nt ??= 5000\nsetTimeout(f, t)`, v, '신설'],
  ['V07', 'P3′', 'B2 같은 파일 대입 ||=', 1, `let t\nt ||= 5000\nsetTimeout(f, t)`, v, '신설'],
  ['V08', 'P3′', 'B3 구조 분해 원천 멤버', 1, `const { ms } = { ms: 5000 }\nsetTimeout(f, ms)`, v, "'P3′ 리터럴 구조 분해'"],
  ['V09', 'P3′', 'B3 구조 분해 매개변수 ← 호출 인자 객체', 1, `function wait({ ms }) { return new Promise((r) => setTimeout(r, ms)) }\nawait wait({ ms: 5000 })`, v, "'P3′ 구조 분해 매개변수 ← 호출 인자 객체'"],
  ['V10', 'P3′', 'B4 매개변수 ← 기본값', 1, `const sleep = (ms = 5000) => new Promise((r) => setTimeout(r, ms))\nawait sleep()`, v, '신설'],
  ['V11', 'P3′', 'B4 매개변수 ← 호출부 위치 인자(화살표)', 1, `${SLEEP}\nawait sleep(5000)`, v, "'P3′ 같은 파일 함수 매개변수 ← 호출 인자'"],
  ['V12', 'P3′', 'B4 함수 선언 — 호출마다 값', 1, `function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }\nawait wait(5000)\nawait wait(400)`, v, "'P3′ 함수 선언의 호출마다 값'"],
  ['V13', 'P3′', 'B4 객체 메서드', 1, `const h = { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait h.wait(5000)`, v, "'P3′ 객체 메서드'"],
  ['V14', 'P3′', 'B4 클래스 메서드', 1, `class F { wait(ms) { return new Promise((r) => setTimeout(r, ms)) } }\nawait new F().wait(5000)`, v, "'P3′ 클래스 메서드'"],
  ['V15', 'P3′', 'B4 속성 화살표', 1, `const h = { wait: (ms) => new Promise((r) => setTimeout(r, ms)) }\nawait h.wait(5000)`, v, "'P3′ 속성 화살표'"],
  ['V15b', 'P3′', 'B4 함수 식을 담은 변수', 1, `const sleep = function (ms) { return new Promise((r) => setTimeout(r, ms)) }\nawait sleep(5000)`, v, '신설'],
  ['V15c', 'P3′', 'B4 클래스 속성 화살표', 1, `class F { wait = (ms) => new Promise((r) => setTimeout(r, ms)) }\nawait new F().wait(5000)`, v, '신설'],
  ['V16', 'P3′', 'B4 호출 결과 ← 반환식(블록 return)', 1, `function budget() { return 5000 }\nsetTimeout(f, budget())`, v, "'P3′ 반환식'"],
  ['V17', 'P3′', 'B4 호출 결과 ← 반환식(화살표 식 몸통)', 1, `const budget = () => 5000\nsetTimeout(f, budget())`, v, '신설'],
  ['V18', 'P3′', 'B5 단축 속성 멤버', 1, `const delay = 5000\nconst cfg = { delay }\nsetTimeout(f, cfg.delay)`, v, '신설'],
  ['V19', 'P3′', 'B6 객체 리터럴 멤버 — 속성 접근', 1, `const cfg = { delay: 5000 }\nsetTimeout(f, cfg.delay)`, v, "'P3′ 멤버 접근'"],
  ['V20', 'P3′', 'B6 객체 리터럴 멤버 — 요소 접근', 1, `const cfg = { delay: 5000 }\nsetTimeout(f, cfg['delay'])`, v, "'P3′ 요소 접근'"],
  ['V21', 'P3′', 'B6 전개 멤버', 1, `const base = { delay: 5000 }\nconst cfg = { ...base }\nsetTimeout(f, cfg.delay)`, v, '신설(V-spreadval)'],
  ['V22', 'P3′', 'B7 ?? 왼쪽', 1, `const t = 5000\nsetTimeout(f, t ?? 0)`, v, '신설(V-or)'],
  ['V23', 'P3′', 'B7 ?? 오른쪽', 1, `pool({ timeoutMs: x ?? 2000 })`, v, "'P3 — 같은 파일 const …'"],
  ['V24', 'P3′', 'B7 || 왼쪽', 1, `const t = 5000\nsetTimeout(f, t || 0)`, v, '신설'],
  ['V25', 'P3′', 'B7 || 오른쪽', 1, `pool({ timeoutMs: x || 2000 })`, v, "'P3 — 같은 파일 const …'"],
  ['V26', 'P3′', 'B7 조건식 앞쪽', 1, `setTimeout(f, fast ? 5000 : 500)`, v, '신설'],
  ['V27', 'P3′', 'B7 조건식 뒤쪽', 1, `setTimeout(f, fast ? 500 : 5000)`, v, "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"],
  ['V28', 'P3′', 'B7 산술 +', 1, `setTimeout(f, 500 + 500)`, v, "'P3 — 같은 파일 const …'"],
  ['V29', 'P3′', 'B7 산술 -', 1, `setTimeout(f, 6000 - 1000)`, v, "'P3′ 조건식 양쪽 · 뺄셈 · as 래퍼'"],
  ['V30', 'P3′', 'B7 산술 *', 1, `setTimeout(f, 60 * 1000)`, v, "'P3 — 같은 파일 const …'"],
  ['V31', 'P3′', 'B7 산술 / — 임계 아래', 0, `setTimeout(f, 1500 / 2)`, v, '신설(V-div)'],
  ['V31b', 'P3′', 'B7 산술 / — 임계 이상', 1, `setTimeout(f, 10000 / 2)`, v, '신설(V-div)'],
  ['V32', 'P3′', 'B7 산술 배율 피연산자', 0, `setTimeout(f, 60 * scaleMs(1000))`, v, "'P3 — 같은 파일 const …'"],
  ['V33', 'P3′', 'B7 여러 값 × 산술 — 조건식', 1, `setTimeout(f, (fast ? 2 : 5) * 1000)`, v, '신설(W2)'],
  ['V34', 'P3′', 'B7 여러 값 × 산술 — 변수 경유', 1, `const n = fast ? 2 : 5\nsetTimeout(f, n * 1000)`, v, '신설(W2b)'],
  ['V35', 'P3′', 'B7 여러 값 × 산술 — 한 조합만 배율', 1, `setTimeout(f, (fast ? scaleMs(2) : 5) * 1000)`, v, '신설'],
  ['V36', 'P3′', 'B7 여러 값 × 산술 — 전부 배율이면 배율 자리 1(위반 0)', 1, `setTimeout(f, (fast ? scaleMs(2) : scaleMs(5)) * 1000)`, d, '신설'],
  ['V37', 'P3′', 'import 식별자는 건너뜀(경계)', 0, `import { T } from './t'\nsetTimeout(f, T)`, v, "'P3 — 같은 파일 const …'"],
  // P4′ 임계
  ['T01', 'P4′', '임계 1000 미만 통과', 0, `setTimeout(f, 999)`, v, "'P4 — 임계 …'"],
  ['T02', 'P4′', '임계 1000 이상 위반', 1, `setTimeout(f, 1000)`, v, "'P4 — 임계 …'"],
  ['T03', 'P4′', 'abort 무임계', 1, `AbortSignal.timeout(10)`, v, "'P4 — 임계 …'"],
  ['T04', 'P4′', '자식 프로세스 아닌 옵션은 임계', 0, `pool({ timeoutMs: 10 })`, v, "'P4 — 임계 …'"],
  ...['execFile', 'execFileSync', 'spawn', 'spawnSync', 'exec', 'execSync', 'fork'].map((n, i) => [
    `T0${5 + i}`.replace('T010', 'T10').replace('T011', 'T11'),
    'P4′',
    `자식 프로세스 무임계 — ${n}`,
    1,
    `${n}(c, a, { timeout: 10 })`,
    v,
    "'P4 — 임계 …'"
  ]),
  ['T12', 'P4′', '자식 프로세스 — 이름공간 호출', 1, `cp.execFile(c, a, { timeout: 10 })`, v, "'P4 — 임계 …'"],
  ['T13', 'P4′', '자식 프로세스 객체 사용 자리 — 바인딩 참조', 1, `const opts = { timeout: 10 }\nexecFile(c, a, opts)`, v, "'P4′ 자식 프로세스 …'"],
  ['T14', 'P4′', '자식 프로세스 객체 사용 자리 — 전개', 1, `const base = { timeout: 10 }\nexecFile(c, a, { ...base })`, v, "'P4′ 자식 프로세스 …'"],
  ['T15', 'P4′', '자식 프로세스 객체 사용 자리 — 대입 대상 객체', 1, `const o = {}\no.timeout = 10\nexecFile(c, a, o)`, v, "'P4′ 자식 프로세스 …'"],
  ['T16', 'P4′', '자식 프로세스 — promisify 변수', 1, `import { execFile } from 'node:child_process'\nconst run = promisify(execFile)\nawait run(c, a, { timeout: 10 })`, v, "'P4′ 자식 프로세스 …'"],
  ['T17', 'P4′', '자식 프로세스 아닌 호출의 참조', 0, `const opts = { timeout: 10 }\npool(opts)`, v, "'P4′ 자식 프로세스 …'"],
  // P5′ 제외 — ΔV1 P5 + 사용 자리
  ['X01', 'P5′', 'scaleMs 인자 제외', 0, `const ms = scaleMs({ timeoutMs: 5000 }.timeoutMs)`, v, '신설'],
  ['X02', 'P5′', 'scaledBudget 인자 제외', 0, `const b = scaledBudget({ hookTimeout: 5000 })`, v, "'P5 — …'"],
  ['X03', 'P5′', 'vi.setConfig 인자 제외 — (H′) 자리 0', 0, `vi.setConfig({ testTimeout: 15_000 })`, d, "'리터럴 vi.setConfig 는 걸리고 scaledBudget 는 통과한다'"],
  ['X04', 'P5′', 'vi.waitFor 옵션(둘째 인자) 제외', 0, `await vi.waitFor(cb, { timeout: 4000 })`, v, "'P5 — …'"],
  ['X05', 'P5′', 'vi.waitFor 첫 인자는 센다', 1, `await vi.waitFor(() => setTimeout(f, 4000))`, v, "'P5 — …'"],
  ['X06', 'P5′', 'it 옵션 객체 제외 — (H′) 자리 0', 0, `it('x', { timeout: 15000 }, fn)`, d, "'옵션 객체 timeout 과 훅 타임아웃도 같다'"],
  ['X07', 'P5′', 'test 옵션 객체 제외 — (H′) 자리 0', 0, `test('x', { timeout: 5000 }, async () => {})`, d, '신설'],
  ['X08', 'P5′', 'describe 옵션 객체 제외 — (H′) 자리 0', 0, `describe('x', { timeout: 5000 }, () => {})`, d, '신설'],
  ['X09', 'P5′', '훅 옵션 객체 제외 — (H′) 자리 0', 0, `beforeEach(async () => {}, { timeout: 5000 })`, d, '신설'],
  ['X10', 'P5′', 'fn 뒤 인자(변수) 제외 — (H′) 자리 0', 0, `const opts = { timeout: 5000 }\nit('x', async () => {}, opts)`, d, '신설'],
  ['X11', 'P5′', 'matcher 피연산자 제외', 0, `expect(x).toMatchObject({ timeout: 60_000 })`, v, "'P5 — …'"],
  ['X12', 'P5′', 'expect.<helper> 인자 제외', 0, `expect(x).toEqual(expect.objectContaining({ timeoutMs: 60_000 }))`, v, "'P5 — …'"],
  ['X13', 'P5′', 'expect(x) 의 x 는 센다', 1, `await expect(wait({ timeoutMs: 1000 })).resolves.toBe('settled')`, v, "'P5 — …'"],
  ['X14', 'P5′', 'elapsed 상한 인자는 센다 — 직접', 1, `expect(Date.now() - start).toBeLessThan(5000)`, v, "'P5 — …'"],
  ['X15', 'P5′', 'elapsed 상한 인자는 센다 — matcher 콜백 안', 1, `expect(x).toSatisfy(() => expect(Date.now() - s).toBeLessThan(5000))`, v, '신설(V-expectx)'],
  ['X16', 'P5′', '사용 자리 — 참조 전부 제외면 제외(Y2b)', 0, `const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`, v, "'P5′ 변수에 담긴 슬롯 …'"],
  ['X17', 'P5′', '사용 자리 — 단축 속성 참조 제외(Y2e)', 0, `const timeout = 4000\nawait vi.waitFor(cb, { timeout })`, v, "'P5′ 변수에 담긴 슬롯 …'"],
  ['X18', 'P5′', '사용 자리 — matcher 피연산자 참조 제외', 0, `const timeoutMs = 5000\nexpect(c.timeoutMs).toBe(timeoutMs)`, v, "'P5′ 변수에 담긴 슬롯 …'"],
  ['X19', 'P5′', '사용 자리 — 하나라도 비제외면 센다(Y2f)', 1, `const o = { timeout: 5000 }\nawait vi.waitFor(cb, o)\npool(o)`, v, "'P5′ 변수에 담긴 슬롯 …'"],
  ['X20', 'P5′', '사용 자리 — 참조 0 이면 선언 자리', 1, `const timeoutMs = 5000`, v, "'P5′ 변수에 담긴 슬롯 …'"],
  ['X21', 'P5′', '사용 자리 — 재귀(변수 → 변수)', 0, `const a = { timeout: 5000 }\nconst b = a\nawait vi.waitFor(cb, b)`, v, '신설'],
  ['X22', 'P5′', '사용 자리 — 함수 인자는 넘지 않는다', 1, `function w(opts) { return vi.waitFor(cb, opts) }\nconst o = { timeout: 5000 }\nawait w(o)`, v, '신설'],
  // P7′ 이중 배율
  ['W01', 'P7′', '인라인 객체 안 scaleMs', 1, `await vi.waitFor(cb, { timeout: scaleMs(4000) })`, w, "'P7 — …'"],
  ['W02', 'P7′', '인라인 숫자 scaleMs', 1, `await vi.waitFor(cb, scaleMs(4000))`, w, "'P7 — …'"],
  ['W03', 'P7′', 'B 식별자 → 객체(Y2)', 1, `const probeOpts = { timeout: scaleMs(5000) }\nawait vi.waitFor(() => {}, probeOpts)`, w, "'P7′ …'"],
  ['W04', 'P7′', 'B 식별자 → 숫자', 1, `const w = scaleMs(4000)\nawait vi.waitFor(cb, w)`, w, "'P7′ …'"],
  ['W05', 'P7′', 'B 단축 속성', 1, `const timeout = scaleMs(4000)\nawait vi.waitFor(cb, { timeout })`, w, '신설'],
  ['W06', 'P7′', 'B 전개', 1, `const base = { timeout: scaleMs(4000) }\nawait vi.waitFor(cb, { ...base, interval: 50 })`, w, "'P7′ …'"],
  ['W07', 'P7′', 'B 멤버', 1, `const cfg = { opts: { timeout: scaleMs(4000) } }\nawait vi.waitFor(cb, cfg.opts)`, w, '신설'],
  ['W08', 'P7′', 'B 호출 반환', 1, `const opts = () => ({ timeout: scaleMs(4000) })\nawait vi.waitFor(cb, opts())`, w, '신설'],
  ['W09', 'P7′', 'vi.waitFor 별칭', 1, `const wf = vi.waitFor\nawait wf(cb, { timeout: scaleMs(4000) })`, w, "'P7′ …'"],
  ['W10', 'P7′', '기준값만이면 0(Y2b)', 0, `const probeOpts = { timeout: 5000 }\nawait vi.waitFor(() => {}, probeOpts)`, w, "'P7′ …'"],
  ['W11', 'P7′', '콜백 함수 안은 보지 않는다', 0, `await vi.waitFor(() => f(scaleMs(4000)))`, w, "'P7 — …'"],
  // P8 now 식
  ['N01', 'P8', 'now 원천 Date.now()', 1, `const d = Date.now() + 5000`, v, "'P2 — deadline now()+N'"],
  ['N02', 'P8', 'now 원천 performance.now()', 1, `const d = 5000 + performance.now()`, v, "'P2 — deadline N+now()'"],
  ['N03', 'P8', 'now 원천 new Date().getTime()', 1, `const d = new Date().getTime() + 5000`, v, "'P8 new Date().getTime()'"],
  ['N04', 'P8', 'now 원천 new Date().valueOf()', 1, `const d = new Date().valueOf() + 5000`, v, '신설(V-valueOf)'],
  ['N05', 'P8', 'B 변수(Y5)', 1, `const start = Date.now()\nconst elapsed = Date.now() - start\nexpect(elapsed).toBeLessThan(5000)`, v, "'P8 경과 변수 상한 단언 (Y5)'"],
  ['N06', 'P8', 'B 변수 — 파생 마감(Y5b)', 1, `const start = Date.now()\nconst deadline = start + 5000\nwhile (Date.now() < deadline) {}`, v, "'P8 파생 마감 (Y5b)'"],
  ['N07', 'P8', 'B 대입', 1, `let s\ns = Date.now()\nconst d = s + 5000`, v, '신설'],
  ['N08', 'P8', 'B 멤버', 1, `const c = { at: Date.now() }\nconst d = c.at + 5000`, v, '신설'],
  ['N09', 'P8', 'B 조건', 1, `const d = (hi ? performance.now() : Date.now()) + 5000`, v, '신설'],
  ['N10', 'P8', '산술(now - start)', 1, `const t0 = performance.now()\nconst el = performance.now() - t0\nif (el > 5000) throw e`, v, "'P8 경과 변수 비교'"],
  ['N11', 'P8', '호출 인자 안은 now 식 아님', 0, `const h = render(Date.now())\nconst n = h + 5000`, v, '신설'],
  ['N12', 'P8', '객체 안은 now 식 아님(Y5i)', 0, `const h = render({ at: Date.now() })\nconst n = h + 5000`, v, "'P8 하한 단언·…'"],
  ['N13', 'P8', '배열 안은 now 식 아님', 0, `const xs = [Date.now()]\nconst n = xs + 5000`, v, '신설'],
  ['N14', 'P8', '하한 단언은 자리 아님(Y5g)', 0, `expect(Date.now() - s).toBeGreaterThanOrEqual(5000)`, v, "'P8 하한 단언·…'"],
  ['N15', 'P8', 'now 식끼리 비교는 자리 아님', 1, `const d = Date.now() + scaleMs(5000)\nwhile (Date.now() < d) {}`, d, "'P8 하한 단언·…'"],
  // P9 자리 동일성
  ['I01', 'P9', '한 리터럴은 한 자리', 1, `const T = 30_000\nsetTimeout(f, T)\nsetTimeout(g, T)`, v, "'P9 …'"],
  ['I02', 'P9', '호출마다 다른 리터럴은 따로', 2, `${SLEEP}\nawait sleep(5000)\nawait sleep(5000)`, v, "'P9 …'"],
  ['I03', 'P9', '제외된 슬롯은 건너뛴다', 1, `const T = 5000\nawait vi.waitFor(cb, { timeout: T })\nsetTimeout(f, T)`, v, '신설'],
  ['I06', 'P9', '자리 줄 = 슬롯 줄 · 값이 다른 줄이면 값 줄', ':2 (값 :1)', `const T = 30_000\nsetTimeout(f, T)`, (code) => analyzeScale('a.test.ts', code, [])[0].split(' ').slice(0, 3).join(' '), "'P9 …'"],
  ['I04', 'P9', '--report 셋째 열 — 배율 아님 · 의미 값', 'LITERAL § semantic', 2, report, "'--report deadline 행 …'(LITERAL) + 신설(semantic)"],
  ['I05', 'P9', '--report 다섯째 열 값 · 여섯째 열 원문', '30_000|setTimeout(f, T) § 2700|setTimeout(g, 2700)', null, () => report([4, 5]), "'--report deadline 행 …'(값) + 신설(원문)"],
  // P1 파일 범위 — ΔV1 P1 그대로
  ['P01', 'P1', '(H′) 범위 *.test.ts', 1, 'a.test.ts', p1, "'P1 — …'"],
  ['P02', 'P1', '(H′) 범위 *.testfixture.ts', 1, 'b.testfixture.ts', p1, "'P1 — …'"],
  ['P03', 'P1', '(H′) 범위 *.testfixture.tsx(JSX)', 1, 'c.testfixture.tsx', p1, "'P1 — …'"],
  ['P04', 'P1', '그 밖의 .ts 무시', 0, 'd.ts', p1, "'P1 — …'"],
  ['P05', 'P1', '(A)~(E) 는 *.test.ts 만', 'a.test.ts', null, p1ae, "'P1 — …'"],
  // P6 허용 목록 — ΔV1 P6 그대로
  ['A01', 'P6', 'count = 자리 수면 통과', 0, ['a', sites(2), ENTRY], a6, "'P6 — 항목 count …'"],
  ['A02', 'P6', '자리가 count 보다 많으면 위반', 1, ['a', sites(3), ENTRY], a6, "'P6 — 항목 count …'"],
  ['A03', 'P6', '자리가 count 보다 적으면 위반', 1, ['a', sites(1), ENTRY], a6, "'P6 — 항목 count …'"],
  ['A04', 'P6', 'reason 빈 값 위반', 1, ['a', sites(2), { ...ENTRY, reason: '' }], a6, "'P6 — 항목 count …'"],
  ['A05', 'P6', '다른 파일 같은 값 위반', 2, ['b', sites(2), ENTRY], a6, "'P6 — 항목 count …'"],
  ['A06', 'P6', '미등록 리터럴 위반', 1, ['a', `setTimeout(f, 6000)\n${sites(2)}`, ENTRY], a6, "'P6 — 항목 count …'"],
]

let mismatch = 0
for (const [id, point, rule, expected, code, measure, ut] of B) {
  let got
  try {
    got = typeof code === 'number' || code === null ? measure() : measure(code)
    if (typeof code === 'number') got = measure(code)
  } catch (error) {
    got = `ERR ${String(error.message).split('\n')[0]}`
  }
  const ok = got === expected
  if (!ok) mismatch++
  if (onlyMismatch && ok) continue
  console.log(`${id}\t${point}\t${rule}\t기대 ${expected}\t현재 ${got}\t${ok ? 'ok' : '판정'}\t${ut}`)
}
console.error(`분기 ${B.length} · 판정 불일치 ${mismatch}`)
