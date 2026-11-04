// 테스트 소유 실시간 마감 자리 전수 스캔 (0294 ΔV1 §10 EP-05a 의 자리 검색 명령).
//
// 술어는 불변식의 주어 — "테스트가 고른 시간 값이 실제 경과 시간의 **상한**이 되는 자리" — 이고,
// 해법 이름(scaleMs 여부)이 아니라 **자리 형태**로 센다. 배율 여부는 결과 칸에만 적는다.
// 사용: node scan-deadlines.mjs <app 디렉토리> [--all]
//   --all  1000ms 미만도 출력(임계 근거 확인용)
// 범위: <app>/src 아래 `*.test.ts` · `*.testfixture.ts` · `*.testfixture.tsx`
//       (vitest include + 테스트가 import 하는 지원 파일. scripts/smoke-*.mjs 는 수동 도구라 제외)
//
// 형태(kind)
//   timer     setTimeout/setInterval(전역·globalThis·window) 지연 · timers/promises 의 setTimeout 첫 인자
//   method    x.setTimeout(N) — 소켓·요청 객체의 시간 상한
//   abort     AbortSignal.timeout(N)
//   deadline  Date.now()/performance.now() + N · now 를 포함한 식과 N 의 비교(<·<=·>·>=)
//   elapsed   expect(now 를 포함한 식).toBeLessThan(OrEqual)(N)
//   option    객체 리터럴의 /timeout/i 키 값 · /timeout/i 이름에 담긴 객체(중첩 포함)의 숫자 속성
//             (`timeouts: { connectMs }`) — 자식 프로세스 timeout · production 시간 인자 · 데이터
//   param     /timeout/i 이름 매개변수의 기본값
// 임계: 1000ms 이상만 센다 — 단 abort 와 자식 프로세스 옵션의 timeout 은 임계 없이 센다.
// 값: 숫자 리터럴 · 같은 파일 `const X = 리터럴` · `a ?? 리터럴`/`a || 리터럴` 의 리터럴 · 리터럴끼리 * +
//     · scaleMs(…) 는 `scaled`. 같은 리터럴을 두 자리가 가리키면 한 번만 센다.
// 제외(이미 다른 장치가 맡거나 마감이 아닌 자리):
//   scaleMs/scaledBudget 인자 · vi.waitFor 의 옵션 인자(setup wrapper 가 배율) · vi.setConfig 인자와
//   it/test/describe/훅의 타임아웃 인자((F) 가 맡음) · 단언 피연산자(expect(x).matcher(…) 의 matcher
//   인자 · expect.objectContaining 등) — 단 expect(x) 의 **대상 x** 는 실제 호출이라 제외하지 않고,
//   elapsed 형태의 상한 인자는 matcher 인자 자체가 자리라 제외하지 않는다.
// 출력: kind\t파일:줄\t값\t상태(scaled|literal)\t파일이 가짜 타이머를 켜는가(fake|-)\t원문
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const app = resolve(process.argv[2] ?? '.')
const all = process.argv.includes('--all')
const ts = createRequire(join(app, 'package.json'))('typescript')
const MIN_MS = 1000
// 임계 없이 보는 자리 — 순서용 지연·시간 초과 유발값으로 쓰이지 않는 상한 형태(트리 실측: 1초 미만 0건).
const CHILD_PROCESS = new Set(['execFile', 'execFileSync', 'spawn', 'spawnSync', 'exec', 'execSync', 'fork'])
const TIMEOUT_NAME = /timeout/i
const TEST_CALLS = new Set(['it', 'test', 'describe', 'bench', 'suite'])
const HOOK_CALLS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])

const list = (d) =>
  readdirSync(d).flatMap((e) => {
    const f = join(d, e)
    if (statSync(f).isDirectory()) return e === 'node_modules' ? [] : list(f)
    return /\.test\.ts$|\.testfixture\.tsx?$/.test(e) ? [f] : []
  })

export function scanDeadlines(rel, text) {
  const src = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true)
  const consts = new Map()
  const promiseTimers = new Set()
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      consts.set(node.name.text, node.initializer)
    if (
      ts.isImportDeclaration(node) &&
      /^(node:)?timers\/promises$/.test(node.moduleSpecifier.text) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    )
      for (const el of node.importClause.namedBindings.elements)
        if ((el.propertyName ?? el.name).text === 'setTimeout') promiseTimers.add(el.name.text)
    ts.forEachChild(node, collect)
  }
  collect(src)
  const line = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
  const rootOf = (expr) => {
    let e = expr
    while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) e = e.expression
    return ts.isIdentifier(e) ? e.text : null
  }
  // 값 노드 → { literal: 값을 담은 노드, value, scaled }
  const resolveValue = (node, depth = 0) => {
    if (!node || depth > 4) return null
    if (ts.isParenthesizedExpression(node)) return resolveValue(node.expression, depth + 1)
    if (ts.isNumericLiteral(node))
      return { literal: node, value: Number(node.text.replace(/_/g, '')), scaled: false }
    if (ts.isCallExpression(node) && node.expression.getText(src) === 'scaleMs')
      return { literal: node, value: null, scaled: true }
    if (ts.isIdentifier(node) && consts.has(node.text)) return resolveValue(consts.get(node.text), depth + 1)
    if (ts.isBinaryExpression(node)) {
      const k = node.operatorToken.kind
      if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken)
        return resolveValue(node.right, depth + 1)
      if (k === ts.SyntaxKind.AsteriskToken || k === ts.SyntaxKind.PlusToken) {
        const l = resolveValue(node.left, depth + 1)
        const r = resolveValue(node.right, depth + 1)
        if (l?.scaled || r?.scaled) return { literal: node, value: null, scaled: true }
        if (l && r)
          return {
            literal: node,
            value: k === ts.SyntaxKind.PlusToken ? l.value + r.value : l.value * r.value,
            scaled: false
          }
      }
    }
    return null
  }
  // keepMatcher: elapsed 형태는 상한 자체가 matcher 인자라 그 제외를 건너뛴다.
  const excluded = (node, keepMatcher = false) => {
    for (let child = node, p = node.parent; p; child = p, p = p.parent) {
      if (!ts.isCallExpression(p)) continue
      const callee = p.expression.getText(src)
      const argIndex = p.arguments.indexOf(child)
      if (argIndex < 0) continue
      if (callee === 'scaleMs' || callee === 'scaledBudget' || callee === 'vi.setConfig') return true
      if (callee === 'vi.waitFor' && argIndex === 1) return true
      const root = rootOf(p.expression)
      if (root && (TEST_CALLS.has(root) || HOOK_CALLS.has(root))) {
        const afterFn = p.arguments
          .slice(0, argIndex)
          .some((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a))
        if (afterFn || ts.isObjectLiteralExpression(child)) return true
      }
      // 단언 피연산자: expect 체인 위 matcher 의 인자 · expect.<helper>(…) 의 인자.
      // expect(x) 자체의 인자 x 는 실제 호출(대상)이라 제외하지 않는다.
      if (!keepMatcher && root === 'expect' && !(ts.isIdentifier(p.expression) && p.expression.text === 'expect'))
        return true
    }
    return false
  }
  // 이 속성을 담은 객체 리터럴(중첩 포함)이 /timeout/i 이름의 속성·변수에 담겼는가 — `timeouts: { connectMs }`.
  const inTimeoutObject = (prop) => {
    for (let object = prop.parent; object && ts.isObjectLiteralExpression(object); ) {
      const owner = object.parent
      if (!owner) return false
      if ((ts.isPropertyAssignment(owner) || ts.isVariableDeclaration(owner)) && TIMEOUT_NAME.test(owner.name.getText(src)))
        return true
      if (!ts.isPropertyAssignment(owner)) return false
      object = owner.parent
    }
    return false
  }
  const mentionsNow = (node) => /\b(Date|performance)\.now\(\)/.test(node.getText(src))
  const isNow = (node) => /^(Date|performance)\.now\(\)$/.test(node.getText(src))
  const seen = new Set()
  const sites = []
  // 객체 리터럴 옵션이 자식 프로세스 호출의 인자인가(execFile(…, { timeout }) 등).
  const childProcessOption = (prop) => {
    const object = prop.parent
    const call = object?.parent
    if (!call || !ts.isCallExpression(call) || !call.arguments.includes(object)) return false
    const e = call.expression
    const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : ''
    return CHILD_PROCESS.has(name)
  }
  const push = (kind, at, valueNode) => {
    if (!valueNode || excluded(valueNode, kind === 'elapsed')) return
    const v = resolveValue(valueNode)
    if (!v) return
    const noThreshold = kind === 'abort' || (kind === 'option' && childProcessOption(at))
    if (!v.scaled && !all && !noThreshold && v.value < MIN_MS) return
    const key = v.literal.getStart(src)
    if (seen.has(key)) return
    seen.add(key)
    sites.push({
      kind,
      line: line(at),
      value: v.scaled ? 'scaleMs' : v.literal.getText(src),
      scaled: v.scaled,
      text: at.getText(src).replace(/\s+/g, ' ').slice(0, 90)
    })
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(src)
      if (/^(globalThis\.|window\.)?(setTimeout|setInterval)$/.test(callee)) push('timer', node, node.arguments[1])
      else if (ts.isIdentifier(node.expression) && promiseTimers.has(callee)) push('timer', node, node.arguments[0])
      else if (/\.setTimeout$/.test(callee)) push('method', node, node.arguments[0])
      else if (callee === 'AbortSignal.timeout') push('abort', node, node.arguments[0])
      else if (
        /\.(toBeLessThan|toBeLessThanOrEqual)$/.test(callee) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isCallExpression(node.expression.expression) &&
        mentionsNow(node.expression.expression)
      )
        push('elapsed', node, node.arguments[0])
    }
    if (ts.isBinaryExpression(node)) {
      const k = node.operatorToken.kind
      const cmp = [
        ts.SyntaxKind.LessThanToken,
        ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.GreaterThanEqualsToken
      ].includes(k)
      if (k === ts.SyntaxKind.PlusToken && isNow(node.left)) push('deadline', node, node.right)
      else if (k === ts.SyntaxKind.PlusToken && isNow(node.right)) push('deadline', node, node.left)
      else if (cmp && mentionsNow(node.left) && !mentionsNow(node.right)) push('deadline', node, node.right)
      else if (cmp && mentionsNow(node.right) && !mentionsNow(node.left)) push('deadline', node, node.left)
    }
    if (ts.isPropertyAssignment(node) && (TIMEOUT_NAME.test(node.name.getText(src)) || inTimeoutObject(node)))
      push('option', node, node.initializer)
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && TIMEOUT_NAME.test(node.name.text))
      push('param', node, node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(src)
  return sites
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rows = []
  for (const file of list(join(app, 'src')).sort()) {
    const rel = relative(app, file).replaceAll('\\', '/')
    const text = readFileSync(file, 'utf8')
    const fake = /useFakeTimers\s*\(/.test(text) ? 'fake' : '-'
    for (const s of scanDeadlines(rel, text))
      rows.push(`${s.kind}\t${rel}:${s.line}\t${s.value}\t${s.scaled ? 'scaled' : 'literal'}\t${fake}\t${s.text}`)
  }
  for (const row of rows) console.log(row)
  const by = {}
  for (const row of rows) {
    const [kind, , , status] = row.split('\t')
    by[`${kind}/${status}`] = (by[`${kind}/${status}`] ?? 0) + 1
  }
  console.error(JSON.stringify({ total: rows.length, ...by }))
}
