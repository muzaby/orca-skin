// 0294 verify r3 — (H′) 판정 적대 입력 탐침. 게이트 판정 함수에 문자열 소스를 넣어 위반 수를 센다.
// 사용: node verify-r3-probes.mjs <app 디렉토리>
// 열: id · 근거 규칙 · 기대(규칙 원문 기준, gap 은 설계 결정 대기) · 결과 · 일치
// 기대는 `analyzeScale`(허용 항목 없음) 위반 수, `w:` 는 `vi.waitFor` 이중 배율 수.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const appDir = resolve(process.argv[2] ?? '.')
const { analyzeScale, scanBudgetSites } = await import(
  pathToFileURL(`${appDir}/scripts/check-test-budgets.mjs`).href
)
const v = (code) => analyzeScale('a.test.ts', code, []).length
const w = (code) => scanBudgetSites('a.test.ts', code, []).filter((s) => s.kind === 'waitFor').length

// [id, 규칙, 기대, 소스, 측정, gap]
const CASES = [
  // 규칙 원문이 덮는데 판정이 다르다 — PAIR_FAIL(D5)
  ['W1', 'ΔV1 P2 timer — timers/promises 의 setTimeout 첫 인자(별칭 없음)', 1, `import { setTimeout } from 'node:timers/promises'\nawait setTimeout(5000)`],
  ['W2', 'P3′ B7 조건식 양쪽 × 산술 — 여러 값이면 값마다', 1, `setTimeout(f, (fast ? 2 : 5) * 1000)`],
  ['W2b', 'P3′ B2·B7 — 여러 값 변수 × 산술', 1, `const n = fast ? 2 : 5\nsetTimeout(f, n * 1000)`],
  ['W3', 'P2′ 중첩 timeouts 소유 — 클래스 필드 이름', 1, `class F { timeouts = { connectMs: 5000 } }`],
  ['W3b', 'P2′ 중첩 timeouts 소유 — 대입 대상 속성 이름', 1, `o.timeouts = { connectMs: 5000 }`],
  ['W7', 'P3′ B4 같은 파일 함수 ← 같은 파일 호출부(IIFE)', 1, `await ((ms) => new Promise((r) => setTimeout(r, ms)))(5000)`],
  // 분기 입력 대조 — 현재 판정은 맞고 UT 에 입력이 없다(같은 입력으로 V-변이를 판정)
  ['V-elem', "P2′ 대입 o['k'] = v", 1, `o['timeoutMs'] = 5000`],
  ['V-oreq', 'P2′ 대입 ||=', 1, `opts.timeoutMs ||= 5000`],
  ['V-util', 'P2′ util.promisify(x)', 1, `import util from 'node:util'\nimport { execFile } from 'node:child_process'\nawait util.promisify(execFile)(c, a, { timeout: 10 })`],
  ['V-peel', 'P2′ 호출 대상 B1 래퍼', 1, `;(setTimeout)(f, 5000)`],
  ['V-div', 'P3′ 산술 / (임계 경계)', 0, `setTimeout(f, 1500 / 2)`],
  ['V-valueOf', 'P8 now 원천 new Date().valueOf()', 1, `const d = new Date().valueOf() + 5000`],
  ['V-gte', 'P8 역방향 toBeGreaterThanOrEqual', 1, `expect(5000).toBeGreaterThanOrEqual(Date.now() - s)`],
  ['V-or', 'P3′ B7 ??·|| 왼쪽', 1, `const t = 5000\nsetTimeout(f, t ?? 0)`],
  ['V-spreadval', 'P3′ B6 전개 멤버', 1, `const base = { delay: 5000 }\nconst cfg = { ...base }\nsetTimeout(f, cfg.delay)`],
  ['V-satisfies', 'P3′ B1 satisfies', 1, `setTimeout(f, 5000 satisfies number)`],
  ['V-nonnull', 'P3′ B1 !', 1, `const d = { ms: 5000 }\nsetTimeout(f, d!.ms)`],
  ['V-expectx', 'ΔV1 P5 elapsed 상한 인자는 센다(matcher 콜백 안)', 1, `expect(x).toSatisfy(() => expect(Date.now() - s).toBeLessThan(5000))`],
  ['M21b', 'P2′ named — 식별자 대입', 1, `let timeoutMs\ntimeoutMs = 5000\nawait waitUntil(s, timeoutMs)`],
  // 규칙 원문끼리 어긋나거나 주어보다 좁다 — PLAN_GAP(D6). 기대는 D-015 주어 기준 제안값
  ['W4', 'P2′ 호출 대상 목록(B1·B2·promisify·import) vs D-015 구조 분해 — vi.waitFor 별칭 기준값', 0, `const { waitFor } = vi\nawait waitFor(cb, { timeout: 5000 })`, v, true],
  ['W4b', '같음 — 별칭 안 scaleMs 이중 배율', 1, `const { waitFor } = vi\nawait waitFor(cb, { timeout: scaleMs(5000) })`, w, true],
  ['W4c', '같음 — setTimeout 구조 분해 별칭', 1, `const { setTimeout: st } = globalThis\nst(f, 5000)`, v, true],
  ['W4d', '같음 — AbortSignal.timeout 구조 분해 별칭', 1, `const { timeout } = AbortSignal\ntimeout(5000)`, v, true],
  ['W10', '같음 — vi[\'waitFor\'] 요소 접근 기준값', 0, `await vi['waitFor'](cb, { timeout: 5000 })`, v, true],
  ['W5', 'P8 now 식 B(변수·대입·멤버·조건) vs D-015 호출 결과←반환식 — 직접 호출', 1, `const now = () => Date.now()\nconst d = now() + 5000`, v, true],
  ['W5b', '같음 — 변수 경유(현재 판정 1)', 1, `function now() { return Date.now() }\nconst s = now()\nwhile (now() - s < 5000) {}`, v, true],
  ['W6', 'D-016 elapsed 두 방향 vs 주어 — .not 상한', 1, `expect(Date.now() - s).not.toBeGreaterThan(5000)`, v, true],
  ['W8', 'D-016 슬롯 param = 기본값만 vs named — 기본값 없는 /timeout/i 매개변수 ← 같은 파일 호출', 1, `function run(timeoutMs) { return prod(timeoutMs) }\nrun(5000)`, v, true],
  ['W9', 'P3′ B2 대입 — 복합 대입 값(+=)', 1, `let t = 500\nt += 4500\nsetTimeout(f, t)`, v, true],
  // D-015 경계 — 규칙상 자리가 아니다(현재 0 이 맞다)
  ['W11', 'D-015 경계 — 객체 리터럴이 아닌 값(배열)의 멤버', 0, `const ds = [5000]\nsetTimeout(f, ds[0])`],
  ['W18', '경계 — Function.prototype.call 경유 호출 대상', 0, `const set = sock.setTimeout\nset.call(sock, 5000)`],
  ['W20', '경계 — 풀리지 않는 피연산자 산술(start 미선언)', 0, `setTimeout(() => { if (Date.now() > start + 5000) fail() }, 10)`],
]

for (const [id, rule, expected, code, measure = v, gap = false] of CASES) {
  let got
  try {
    got = measure(code)
  } catch (error) {
    got = `ERR ${String(error.message).split('\n')[0]}`
  }
  const mark = got === expected ? 'ok' : gap ? 'GAP' : 'MISMATCH'
  console.log(`${id}\t${rule}\t기대 ${expected}\t결과 ${got}\t${mark}`)
}
