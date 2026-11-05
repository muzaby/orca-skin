// 0294 ΔV4 — (H′) 식 노드 종류 표(EP-12d)의 칸마다 UT 입력과 기대. 게이트 판정 함수에 문자열 소스를 넣어 대조한다.
// 판정 기대의 정본은 plan §7-E 노드 종류 표이고 이 파일은 그 입력의 실행본이다. ΔV3 분기 목록(dv3-branches.mjs)과 함께 돈다.
// 사용: node dv4-cells.mjs <app 디렉토리> [--only-mismatch]
// 측정 vu = `위반 수/판정 불가 수`(analyzeScale, 의미 값·허용 항목 없음) · w = vi.waitFor 이중 배율 수 · d = deadline 자리 수(배율 포함)
//      vux = vu 를 'a.testfixture.tsx' 로(JSX) · A 행은 UNRESOLVED_ALLOWED 넷째 인자와 CLI.
// '판정 불가' 는 ΔV4 의 새 위반 문구 표식이다 — 위반 줄에 '판정 불가' 와 칸 ID(예: KF05)가 함께 있다.
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const appDir = resolve(process.argv[2] ?? '.')
const onlyMismatch = process.argv.includes('--only-mismatch')
const { analyzeScale, scanBudgetSites, runCli } = await import(
  pathToFileURL(`${appDir}/scripts/check-test-budgets.mjs`).href
)
const lines = (code, file = 'a.test.ts', allowed = []) => analyzeScale(file, code, [], allowed)
const vu = (code) => {
  const out = lines(code)
  return `${out.length}/${out.filter((l) => l.includes('판정 불가')).length}`
}
const vux = (code) => {
  const out = lines(code, 'a.testfixture.tsx')
  return `${out.length}/${out.filter((l) => l.includes('판정 불가')).length}`
}
const w = (code) => scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'waitFor').length
const d = (code) => scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'deadline').length

// A 행 — 판정 불가 자리(KF05) 하나를 담은 파일 'a' 와 허용 항목
const RED = `import { computeDelay } from './d'\nsetTimeout(f, computeDelay())`
const RED2 = `${RED}\nsetTimeout(g, computeDelay())`
const ITEM = { file: 'a', reason: 'KF05', count: 1, why: 'w' }
const allow = ([code, items]) => lines(code, 'a', items).length
const cli = (files, items, argv = []) => {
  const root = mkdtempSync(join(tmpdir(), 'dv4-'))
  const out = []
  const [log, err] = [console.log, console.error]
  console.log = (l) => out.push(l)
  console.error = (l) => out.push(l)
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), body)
    }
    const code = runCli(root, argv, [], items)
    return { code, out }
  } finally {
    console.log = log
    console.error = err
    rmSync(root, { recursive: true, force: true })
  }
}

const P = 'pool({ timeoutMs: X })'
const nn = (x) => P.replace('X', x)
// [ID, 칸, 규칙 조각, 기대, 소스, 측정, 출처]
const C = [
  // KV — 값 자리 식 종류(래퍼를 벗긴 뒤)
  ['KV01', 'KV', '숫자 리터럴 → 숫자', '1/0', `setTimeout(f, 5000)`, vu, 'ΔV3 F01'],
  ['KV02', 'KV', '+ 숫자 리터럴 → 숫자', '1/0', nn('+5000'), vu, '신설'],
  ['KV02b', 'KV', '- 숫자 리터럴 → 숫자(음수 — 임계 아래)', '0/0', nn('-5000'), vu, '신설'],
  ['KV03', 'KV', 'scaleMs(…) → 배율', 1, `setTimeout(f, scaleMs(5000))`, d, 'ΔV3 F01 배율 판본'],
  ['KV04a', 'KV', '래퍼 ( )', '1/0', `setTimeout(f, (5000))`, vu, '신설'],
  ['KV04b', 'KV', '래퍼 as', '1/0', `setTimeout(f, 5000 as number)`, vu, '신설'],
  ['KV04c', 'KV', '래퍼 satisfies', '1/0', `setTimeout(f, 5000 satisfies number)`, vu, '신설(verify r3 V-satisfies)'],
  ['KV04d', 'KV', '래퍼 !', '1/0', `const d = { ms: 5000 }\nsetTimeout(f, d!.ms)`, vu, '신설(verify r3 V-nonnull)'],
  ['KV04e', 'KV', '래퍼 <T>x', '1/0', `setTimeout(f, <number>5000)`, vu, '신설'],
  ['KV05', 'KV', '산술 + - * / → R4(ΔV3 V28~V36)', '1/0', `setTimeout(f, (fast ? 2 : 5) * 1000)`, vu, 'ΔV3 V33'],
  ['KV06', 'KV', '?? · || → 양쪽(ΔV3 V22~V25)', '1/0', `const t = 5000\nsetTimeout(f, t ?? 0)`, vu, 'ΔV3 V22'],
  ['KV07', 'KV', '&& → 오른쪽(왼쪽은 숫자 아님)', '1/0', `setTimeout(f, ok && 5000)`, vu, '신설'],
  ['KV08', 'KV', '쉼표 → 오른쪽', '1/0', `setTimeout(f, (g(), 5000))`, vu, '신설'],
  ['KV09', 'KV', '비교·동등·in·instanceof → 숫자 아님', '0/0', nn('a > 1'), vu, '신설'],
  ['KV09b', 'KV', '동등(===) → 숫자 아님', '0/0', nn('a === 1'), vu, '신설'],
  ['KV09c', 'KV', 'in → 숫자 아님', '0/0', nn(`'k' in o`), vu, '신설'],
  ['KV09d', 'KV', 'instanceof → 숫자 아님', '0/0', nn('a instanceof B'), vu, '신설'],
  ['KV10', 'KV', '그 밖 이항 연산(%) → red', '1/1', `setTimeout(f, 10000 % 7)`, vu, '신설'],
  ['KV10b', 'KV', '그 밖 이항 연산(**) → red', '1/1', `setTimeout(f, 10 ** 4)`, vu, '신설'],
  ['KV11', 'KV', '대입 연산 식 → red', '1/1', `let t\nsetTimeout(f, (t = 5000))`, vu, '신설'],
  ['KV12', 'KV', '조건식 → 양쪽(ΔV3 V26·V27)', '1/0', `setTimeout(f, fast ? 5000 : 500)`, vu, 'ΔV3 V26'],
  ['KV13a', 'KV', '숫자 아님 — 문자열', '0/0', nn(`'5000'`), vu, '신설'],
  ['KV13b', 'KV', '숫자 아님 — 치환 없는 템플릿', '0/0', nn('`5000`'), vu, '신설'],
  ['KV13c', 'KV', '숫자 아님 — 템플릿 식', '0/0', nn('`${n}`'), vu, '신설'],
  ['KV13d', 'KV', '숫자 아님 — 정규식', '0/0', nn('/x/'), vu, '신설'],
  ['KV13e', 'KV', '숫자 아님 — true', '0/0', nn('true'), vu, '신설'],
  ['KV13f', 'KV', '숫자 아님 — false', '0/0', nn('false'), vu, '신설'],
  ['KV13g', 'KV', '숫자 아님 — null', '0/0', nn('null'), vu, '신설'],
  ['KV13h', 'KV', '숫자 아님 — 객체 리터럴', '0/0', nn('{}'), vu, '신설'],
  ['KV13i', 'KV', '숫자 아님 — 배열 리터럴', '0/0', nn('[]'), vu, '신설'],
  ['KV13j', 'KV', '숫자 아님 — 함수 식', '0/0', nn('function () {}'), vu, '신설'],
  ['KV13k', 'KV', '숫자 아님 — 화살표 함수', '0/0', nn('() => 0'), vu, '신설'],
  ['KV13l', 'KV', '숫자 아님 — 클래스 식', '0/0', nn('class {}'), vu, '신설'],
  ['KV13m', 'KV', '숫자 아님 — JSX 요소', '0/0', nn('<div></div>'), vux, '신설'],
  ['KV13n', 'KV', '숫자 아님 — JSX 자기 닫힘', '0/0', nn('<div />'), vux, '신설'],
  ['KV13o', 'KV', '숫자 아님 — JSX 조각', '0/0', nn('<></>'), vux, '신설'],
  ['KV13p', 'KV', '숫자 아님 — typeof', '0/0', nn('typeof x'), vu, '신설'],
  ['KV13q', 'KV', '숫자 아님 — void', '0/0', nn('void 0'), vu, '신설'],
  ['KV13r', 'KV', '숫자 아님 — delete', '0/0', nn('delete o.x'), vu, '신설'],
  ['KV13s', 'KV', '숫자 아님 — BigInt 리터럴', '0/0', nn('5000n'), vu, '신설'],
  ['KV13t', 'KV', '숫자 아님 — new', '0/0', nn('new Date()'), vu, '신설'],
  ['KV13u', 'KV', '숫자 아님 — !x', '0/0', nn('!x'), vu, '신설'],
  ['KV14', 'KV', 'await → red', '1/1', `setTimeout(f, await delay)`, vu, '신설'],
  ['KV15', 'KV', 'this → red', '1/1', `function g() { setTimeout(f, this) }`, vu, '신설'],
  ['KV16a', 'KV', '후위 ++ → red', '1/1', `let n = 1\nsetTimeout(f, n++)`, vu, '신설'],
  ['KV16b', 'KV', '전위 ++ → red', '1/1', `let n = 1\nsetTimeout(f, ++n)`, vu, '신설'],
  ['KV16c', 'KV', '~ → red', '1/1', `setTimeout(f, ~n)`, vu, '신설'],
  ['KV16d', 'KV', '리터럴 아닌 - → red', '1/1', `setTimeout(f, -n)`, vu, '신설'],
  ['KV16e', 'KV', '후위 -- → red', '1/1', `let n = 9000\nsetTimeout(f, n--)`, vu, '신설'],
  ['KV16f', 'KV', '전위 -- → red', '1/1', `let n = 9000\nsetTimeout(f, --n)`, vu, '신설'],
  ['KV16g', 'KV', '리터럴 아닌 + → red', '1/1', `setTimeout(f, +n)`, vu, '신설'],
  ['KV17a', 'KV', '그 밖 종류(태그 템플릿) → red', '1/1', 'setTimeout(f, tag`5000`)', vu, '신설'],
  ['KV17b', 'KV', '그 밖 종류(yield) → red', '1/1', `function* g() { setTimeout(f, yield) }`, vu, '신설'],
  // KD — 식별자의 선언
  ['KD01', 'KD', '변수 초기값 + 대입 = ??= ||=(ΔV3 V04~V07)', '1/0', `let t = scaleMs(500)\nt = 5000\nsetTimeout(f, t)`, vu, 'ΔV3 V05'],
  ['KD02', 'KD', '복합 대입이 있는 변수 → red', '1/1', `let t = 500\nt += 4500\nsetTimeout(f, t)`, vu, '신설(verify r3 W9)'],
  ['KD03', 'KD', '값 없는 변수 → 숫자 아님', '0/0', `let t\nsetTimeout(f, t)`, vu, '신설'],
  ['KD03b', 'KD', 'declare 변수 → 경계', '0/0', `declare const LIMIT: number\nsetTimeout(f, LIMIT)`, vu, '신설'],
  ['KD04a', 'KD', 'for-of 변수 → red', '1/1', `for (const ms of [1000, 5000]) setTimeout(f, ms)`, vu, '신설'],
  ['KD04b', 'KD', 'for-in 변수 → red', '1/1', `for (const k in o) setTimeout(f, k)`, vu, '신설'],
  ['KD05', 'KD', '구조 분해 — 중첩', '1/0', `const { a: { ms } } = { a: { ms: 5000 } }\nsetTimeout(f, ms)`, vu, '신설'],
  ['KD06', 'KD', '매개변수 — 같은 파일 호출부(ΔV3 V10~V16)', '1/0', `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))\nawait sleep(5000)`, vu, 'ΔV3 V11'],
  ['KD07', 'KD', '매개변수 — 즉시 호출 인자', '1/0', `await ((ms) => new Promise((r) => setTimeout(r, ms)))(5000)`, vu, '신설(verify r3 W7)'],
  ['KD08a', 'KD', '매개변수 — 호출부 없음, 인자로 넘긴 함수 → 경계', '0/0', `run((ms) => setTimeout(f, ms))`, vu, '신설'],
  ['KD08b', 'KD', '매개변수 — 호출부 없음, 객체 속성에 둔 함수 → 경계', '0/0', `const h = { later: (fn, ms) => setTimeout(fn, ms) }`, vu, '신설'],
  ['KD08c', 'KD', '매개변수 — 호출부 없음, 배열 요소 함수 → 경계', '0/0', `const hs = [(ms) => setTimeout(f, ms)]`, vu, '신설'],
  ['KD08d', 'KD', '매개변수 — 호출부 없음, 반환한 함수 → 경계', '0/0', `function mk() { return (ms) => setTimeout(f, ms) }`, vu, '신설'],
  ['KD08e', 'KD', '매개변수 — 호출부 없음, 클래스 속성 함수 → 경계', '0/0', `class H { later = (ms) => setTimeout(f, ms) }`, vu, '신설'],
  ['KD09a', 'KD', '매개변수 — 호출부 없는 함수 선언 → red', '1/1', `export function wait(ms) { return new Promise((r) => setTimeout(r, ms)) }`, vu, '신설'],
  ['KD09b', 'KD', '매개변수 — 호출부 없는 변수 함수 → red', '1/1', `const wait = (ms) => new Promise((r) => setTimeout(r, ms))`, vu, '신설'],
  ['KD10a', 'KD', 'import 이름 → 경계(ΔV3 V37)', '0/0', `import { T } from './t'\nsetTimeout(f, T)`, vu, 'ΔV3 V37'],
  ['KD10b', 'KD', 'import 기본 → 경계', '0/0', `import T from './t'\nsetTimeout(f, T)`, vu, '신설'],
  ['KD10c', 'KD', 'import 이름공간 멤버 → 경계', '0/0', `import * as t from './t'\nsetTimeout(f, t.T)`, vu, '신설'],
  ['KD11', 'KD', '함수 선언 → 숫자 아님', '0/0', `function g() {}\nsetTimeout(f, g)`, vu, '신설'],
  ['KD11b', 'KD', '클래스 선언 → 숫자 아님', '0/0', `class C {}\nsetTimeout(f, C)`, vu, '신설'],
  ['KD11c', 'KD', 'enum 선언 → 숫자 아님', '0/0', `enum E { A }\nsetTimeout(f, E)`, vu, '신설'],
  ['KD12a', 'KD', '선언 없음 — undefined → 숫자 아님', '0/0', nn('undefined'), vu, '신설'],
  ['KD12b', 'KD', '선언 없음 — Infinity → 숫자 아님', '0/0', nn('Infinity'), vu, '신설'],
  ['KD12c', 'KD', '선언 없음 — NaN → 숫자 아님', '0/0', nn('NaN'), vu, '신설'],
  ['KD12d', 'KD', '선언 없음 — 함수 전역(setTimeout 등) → 숫자 아님', '0/0', `pool({ setTimeout })`, vu, '신설'],
  ['KD12e', 'KD', '선언 없음 — 그 밖 lib 전역 → 경계', '0/0', `setTimeout(f, LIMIT)`, vu, '신설'],
  ['KD13', 'KD', 'catch 변수 → red', '1/1', `try { g() } catch (ms) { setTimeout(f, ms) }`, vu, '신설'],
  ['KD14', 'KD', '표 밖 선언 종류(모듈 선언) → red', '1/1', `namespace N {}\nsetTimeout(f, N)`, vu, '신설'],
  // KM — 멤버(리터럴 키)
  ['KM01', 'KM', '객체 리터럴 속성·단축 속성·전개(ΔV3 V18~V21)', '1/0', `const cfg = { delay: 5000 }\nsetTimeout(f, cfg.delay)`, vu, 'ΔV3 V19'],
  ['KM02', 'KM', '키 없음 → 숫자 아님', '0/0', `const c = { a: 1 }\nsetTimeout(f, c.delay)`, vu, '신설'],
  ['KM03a', 'KM', '메서드 → 숫자 아님', '0/0', `const c = { d() { return 1 } }\nsetTimeout(f, c.d)`, vu, '신설'],
  ['KM03b', 'KM', 'getter → red', '1/1', `const c = { get d() { return 5000 } }\nsetTimeout(f, c.d)`, vu, '신설'],
  ['KM04', 'KM', '배열 리터럴 + 숫자 키 → 요소', '1/0', `const ds = [5000]\nsetTimeout(f, ds[0])`, vu, '신설(verify r3 W11)'],
  ['KM05', 'KM', '배열 리터럴의 그 밖 멤버 → red', '1/1', `setTimeout(f, [1, 2].length)`, vu, '신설'],
  ['KM05b', 'KM', '문자열 리터럴의 멤버 → red', '1/1', `setTimeout(f, 'abc'.length)`, vu, '신설'],
  ['KM06a', 'KM', 'this.이름 → 같은 클래스 속성 초기값', '1/0', `class F { ms = 5000; run() { setTimeout(f, this.ms) } }`, vu, '신설'],
  ['KM06b', 'KM', 'this.이름 — 배율 초기값', '0/0', `class F { ms = scaleMs(5000); run() { setTimeout(f, this.ms) } }`, vu, '신설'],
  ['KM06c', 'KM', 'this.이름 — 속성 선언 없음 → red', '1/1', `class F { run() { setTimeout(f, this.ms) } }`, vu, '신설'],
  ['KM07a', 'KM', '원천이 lib 전역 → 경계', '0/0', `setTimeout(f, Number.MAX_SAFE_INTEGER)`, vu, '신설'],
  ['KM07b', 'KM', '원천이 콜백 매개변수 → 경계', '0/0', `run((o) => setTimeout(f, o.ms))`, vu, '신설'],
  ['KM07c', 'KM', '원천이 declare 변수 → 경계', '0/0', `declare const C: { ms: number }\nsetTimeout(f, C.ms)`, vu, '신설'],
  ['KM08a', 'KM', '원천이 new → red', '1/1', `setTimeout(f, new Cfg().ms)`, vu, '신설'],
  ['KM08b', 'KM', '원천이 호출 결과 → red', '1/1', `import { load } from './l'\nsetTimeout(f, load().ms)`, vu, '신설'],
  ['KM08c', 'KM', '원천이 enum 선언 → red', '1/1', `enum E { A = 5000 }\nsetTimeout(f, E.A)`, vu, '신설'],
  ['KM09', 'KM', '계산 키 → red', '1/1', `const cfg = { a: 5000 }\nsetTimeout(f, cfg[k])`, vu, '신설'],
  // KF — 호출 결과
  ['KF02', 'KF', '같은 파일 함수 → 반환식(ΔV3 V16·V17)', '1/0', `const budget = () => 5000\nsetTimeout(f, budget())`, vu, 'ΔV3 V17'],
  ['KF03', 'KF', '즉시 호출 → 반환식', '1/0', `setTimeout(f, (() => 5000)())`, vu, '신설'],
  ['KF04a', 'KF', '타이머 핸들 호출 → 숫자 아님', '0/0', `const timeout = setTimeout(f, scaleMs(1000))`, vu, '신설'],
  ['KF04b', 'KF', 'mock 체인(vi.spyOn) → 숫자 아님', '0/0', `const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => s)`, vu, '신설'],
  ['KF04c', 'KF', 'mock(vi.fn) → 숫자 아님', '0/0', `const timeoutFn = vi.fn()`, vu, '신설'],
  ['KF04d', 'KF', '타이머 핸들 호출(setInterval) → 숫자 아님', '0/0', `const timeoutH = setInterval(f, scaleMs(1000))`, vu, '신설'],
  ['KF04e', 'KF', '타이머 핸들 호출(setImmediate) → 숫자 아님', '0/0', `const timeoutI = setImmediate(f)`, vu, '신설'],
  ['KF04f', 'KF', 'mock(vi.mocked) → 숫자 아님', '0/0', `const timeoutM = vi.mocked(x)`, vu, '신설'],
  ['KF05a', 'KF', '그 밖 호출(import 함수) → red', '1/1', RED, vu, '신설'],
  ['KF05b', 'KF', '그 밖 호출(lib 함수) → red', '1/1', `setTimeout(f, Math.max(1000, 5000))`, vu, '신설'],
  // KC — 호출 대상
  ['KC01a', 'KC', '래퍼 satisfies', '1/0', `;(setTimeout satisfies typeof setTimeout)(f, 5000)`, vu, '신설'],
  ['KC01b', 'KC', '래퍼 !', '1/0', `;(setTimeout!)(f, 5000)`, vu, '신설'],
  ['KC01c', 'KC', '래퍼 <T>x', '1/0', `;(<typeof setTimeout>setTimeout)(f, 5000)`, vu, '신설'],
  ['KC04a', 'KC', '재대입 변수 — 후보에 형태 이름 → red', '1/1', `let st = clearTimeout\nst = setTimeout\nst(f, 5000)`, vu, '신설(ΔV3 L11)'],
  ['KC04b', 'KC', '재대입 변수 — 형태 이름 없음 → 형태 아님', '0/0', `let r = a\nr = b\nr(f, 5000)`, vu, '신설'],
  ['KC05a', 'KC', '구조 분해 → 원천.속성(globalThis)', '1/0', `const { setTimeout: st } = globalThis\nst(f, 5000)`, vu, '신설(verify r3 W4c)'],
  ['KC05b', 'KC', '구조 분해 → 원천.속성(AbortSignal)', '1/0', `const { timeout } = AbortSignal\ntimeout(5000)`, vu, '신설(verify r3 W4d)'],
  ['KC05c', 'KC', '구조 분해 → vi.waitFor 이중 배율', 1, `const { waitFor } = vi\nawait waitFor(cb, { timeout: scaleMs(5000) })`, w, '신설(verify r3 W4b)'],
  ['KC05d', 'KC', '구조 분해 → vi.waitFor 옵션 제외(오탐 해소)', '0/0', `const { waitFor } = vi\nawait waitFor(cb, { timeout: 5000 })`, vu, '신설(verify r3 W4)'],
  ['KC06', 'KC', 'import — 다른 모듈의 같은 이름 → 형태 아님', '0/0', `import { setTimeout as st } from './fake-timers'\nst(f, 5000)`, vu, '신설'],
  ['KC07', 'KC', '매개변수 → 형태 아님', '0/0', `function g(st) { st(f, 5000) }`, vu, '신설'],
  ['KC08a', 'KC', '속성 접근 — 소유자 별칭(vi)', 1, `const v = vi\nawait v.waitFor(cb, { timeout: scaleMs(4000) })`, w, '신설'],
  ['KC08b', 'KC', '속성 접근 — 소유자 별칭(globalThis)', '1/0', `const g = globalThis\ng.setTimeout(f, 5000)`, vu, '신설'],
  ['KC09a', 'KC', '요소 접근 리터럴 키 — setTimeout', '1/0', `globalThis['setTimeout'](f, 5000)`, vu, '신설'],
  ['KC09b', 'KC', '요소 접근 리터럴 키 — vi.waitFor 제외(오탐 해소)', '0/0', `await vi['waitFor'](cb, { timeout: 5000 })`, vu, '신설(verify r3 W10)'],
  ['KC10', 'KC', '요소 접근 계산 키 → 형태 아님', '0/0', `timers[k](f, 5000)`, vu, '신설'],
  ['KC11', 'KC', 'promisify 밖 호출의 결과 → 형태 아님', '0/0', `getTimer()(f, 5000)`, vu, '신설'],
  ['KC12', 'KC', '같은 파일 함수 선언 → 형태 아님', '0/0', `function st(fn, ms) {}\nst(f, 5000)`, vu, '신설'],
  ['KC13a', 'KC', '그 밖 종류(태그 템플릿) → 형태 아님', '0/0', 'tag`x`(f, 5000)', vu, '신설'],
  ['KC13b', 'KC', 'import() → 형태 아님', '0/0', `await import('./x')`, vu, '신설'],
  ['KC13c', 'KC', 'super(…) → 형태 아님', '0/0', `class A extends B { constructor() { super(5000) } }`, vu, '신설'],
  // KN — now 식
  ['KN04', 'KN', '같은 파일 함수 호출 반환', '1/0', `const now = () => Date.now()\nconst d = now() + 5000`, vu, '신설(verify r3 W5)'],
  ['KN05', 'KN', '즉시 호출 반환', '1/0', `const d = (() => Date.now())() + 5000`, vu, '신설'],
  ['KN06', 'KN', 'X.getTime() — X → 인자 없는 new Date()', '1/0', `const t = new Date()\nconst d = t.getTime() + 5000`, vu, '신설'],
  ['KN06b', 'KN', 'X.valueOf() — X → 인자 없는 new Date()', '1/0', `const t = new Date()\nconst d = t.valueOf() + 5000`, vu, '신설'],
  ['KN08a', 'KN', '그 밖 — import 호출 → now 아님', '0/0', `import { now } from './clock'\nconst d = now() + 5000`, vu, '신설'],
  ['KN08b', 'KN', '그 밖 — 복합 대입 카운터 → now 아님', '0/0', `let c = 0\nc += 1\nif (c < 2100) g()`, vu, '신설'],
  ['KN08c', 'KN', '그 밖 — lib 호출(Date.UTC) → now 아님', '0/0', `const d = Date.UTC(2020, 0, 1) + 60_000`, vu, '신설'],
  ['KN08d', 'KN', '그 밖 — 매개변수 → now 아님', '0/0', `function g(t0) { if (t0 + 5000 > x) h() }`, vu, '신설'],
  ['KN08e', 'KN', '그 밖 — lib 전역 → now 아님', '0/0', `const d = START + 5000`, vu, '신설'],
  // KE — elapsed matcher
  ['KE02a', 'KE', '.not.toBeGreaterThan(N) on now → 상한', '1/0', `expect(Date.now() - s).not.toBeGreaterThan(5000)`, vu, '신설(verify r3 W6)'],
  ['KE02b', 'KE', '.not.toBeGreaterThanOrEqual(N) on now → 상한', '1/0', `expect(Date.now() - s).not.toBeGreaterThanOrEqual(5000)`, vu, '신설'],
  ['KE02c', 'KE', 'expect(N).not.toBeLessThan(now) → 상한', '1/0', `expect(5000).not.toBeLessThan(Date.now() - s)`, vu, '신설'],
  ['KE02d', 'KE', 'expect(N).not.toBeLessThanOrEqual(now) → 상한', '1/0', `expect(5000).not.toBeLessThanOrEqual(Date.now() - s)`, vu, '신설'],
  ['KE03a', 'KE', '.not.toBeLessThan(N) on now → 하한(자리 아님)', '0/0', `expect(Date.now() - s).not.toBeLessThan(5000)`, vu, '신설'],
  ['KE03b', 'KE', 'expect(N).not.toBeGreaterThan(now) → 하한(자리 아님)', '0/0', `expect(5000).not.toBeGreaterThan(Date.now() - s)`, vu, '신설'],
  ['KE05', 'KE', '.resolves 체인 → 자리 아님', '0/0', `await expect(p).resolves.toBeLessThan(5000)`, vu, '신설'],
  // KO — timeouts 소유 이름
  ['KO02', 'KO', '클래스 필드', '1/0', `class F { timeouts = { connectMs: 5000 } }`, vu, '신설(verify r3 W3)'],
  ['KO03a', 'KO', '대입 대상 속성', '1/0', `o.timeouts = { connectMs: 5000 }`, vu, '신설(verify r3 W3b)'],
  ['KO03b', 'KO', '대입 대상 요소(리터럴 키)', '1/0', `o['timeouts'] = { connectMs: 5000 }`, vu, '신설'],
  ['KO04', 'KO', '구조 분해 기본값', '1/0', `const { timeouts = { connectMs: 5000 } } = o`, vu, '신설'],
  ['KO05', 'KO', '그 밖 이름 → 소유 아님', '0/0', `pool({ other: { connectMs: 5000 } })`, vu, '신설'],
  // KP — /timeout/i 매개변수 슬롯
  ['KP02', 'KP', '기본값 없음 — 같은 파일 호출 인자', '1/0', `function run(timeoutMs) { return prod(timeoutMs) }\nrun(5000)`, vu, '신설(verify r3 W8)'],
  ['KP03', 'KP', '기본값 없음 — 호출부 없음, 넘긴 함수 → 경계', '0/0', `run((timeoutMs) => prod(timeoutMs))`, vu, '신설'],
  ['KP04', 'KP', '기본값 없음 — 호출부 없는 이름 붙은 함수 → red', '1/1', `export function wait(timeoutMs) { return prod(timeoutMs) }`, vu, '신설'],
  // KA — 판정 불가 허용 목록 UNRESOLVED_ALLOWED {file, reason, count, why}
  ['KA01', 'KA', 'count = 판정 불가 자리 수 → 통과', 0, [RED, [ITEM]], allow, '신설'],
  ['KA02', 'KA', 'count 가 자리보다 많음 → 위반', 1, [RED, [{ ...ITEM, count: 2 }]], allow, '신설'],
  ['KA03', 'KA', 'count 가 자리보다 적음 → 위반', 1, [RED2, [ITEM]], allow, '신설'],
  ['KA04', 'KA', 'why 빈 값 → 위반', 1, [RED, [{ ...ITEM, why: ' ' }]], allow, '신설'],
  ['KA05', 'KA', '다른 파일 항목 → 덮지 않음', 1, [RED, [{ ...ITEM, file: 'b' }]], allow, '신설'],
  ['KA06', 'KA', '다른 사유 항목 → 덮지 않음 + 항목 count 불일치', 2, [RED, [{ ...ITEM, reason: 'KD02' }]], allow, '신설'],
  ['KA07', 'KA', '대상 파일 없는 항목 → CLI 위반', 1, null, () => cli({ 'src/a.test.ts': `it('x', () => {})\n` }, [{ ...ITEM, file: 'gone.test.ts' }]).code, '신설'],
  ['KA08', 'KA', '위반 문구에 판정 불가 · 칸 ID', 'true', RED, (code) => String(lines(code).some((l) => l.includes('판정 불가') && l.includes('KF05'))), '신설'],
  ['KA09', 'KA', '--report 판정 불가 행 — 셋째 열 UNRESOLVED · allowed · 다섯째 열 칸 ID', 'UNRESOLVED|KF05 § allowed|KF05', null, () => {
    const pick = (items) => cli({ 'src/a.test.ts': `${RED}\n` }, items, ['--report']).out.filter((l) => /^deadline\t/.test(l)).map((l) => l.split('\t')).filter((c) => c[2] === 'UNRESOLVED' || c[2] === 'allowed').map((c) => `${c[2]}|${c[4]}`).join(',')
    return `${pick([])} § ${pick([{ ...ITEM, file: 'a.test.ts' }])}`
  }, '신설'],
]

let mismatch = 0
for (const [id, cell, rule, expected, code, measure, src] of C) {
  let got
  try {
    got = code === null ? measure() : measure(code)
  } catch (error) {
    got = `ERR ${String(error.message).split('\n')[0]}`
  }
  const ok = String(got) === String(expected)
  if (!ok) mismatch++
  if (onlyMismatch && ok) continue
  console.log(`${id}\t${cell}\t${rule}\t기대 ${expected}\t현재 ${got}\t${ok ? 'ok' : '판정'}\t${src}`)
}
console.error(`칸 입력 ${C.length} · 판정 불일치 ${mismatch}`)
