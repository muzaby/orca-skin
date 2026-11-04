// 테스트 소유 실시간 마감 자리 전수 스캔 — 0294 ΔV2 §10 EP-05b 의 자리 검색 명령.
//
// ΔV1 스캔(scan-deadlines.mjs)과 술어 주어는 같다 — "테스트가 고른 시간 값이 실제 경과 시간의 상한이
// 되는 자리". ΔV2 는 형태 판정이 보는 **모든 식 자리**(형태의 대상 · 값 · 옵션 객체 · 맥락)를
// 같은 파일 바인딩 해석기 하나로 푼다(plan §7-C D-015). 이 파일은 설계자 시제품이며 게이트
// (app/scripts/check-test-budgets.mjs)와 따로 작성했다 — 구현 뒤 `--report` 와 파일:줄·값 차집합으로 대조한다.
//
// 사용: node scan-deadlines-v2.mjs <app 디렉토리> [--all] [--unresolved] [--probe < 입력.json]
//   (기본)        자리 행: 형태 \t 파일:슬롯줄 \t 값(리터럴 원문|scaleMs) \t scaled|literal \t fake|- \t 값:줄|- \t 원문
//   --all         1000ms 미만도 출력(임계 근거)
//   --unresolved  형태 자리 중 값이 같은 파일 선언 그래프 안에서 숫자로 풀리지 않은 자리와 그 이유(경계 측정)
//   --probe       stdin 의 JSON [{name, code, file?}] 을 판정해 리터럴·배율 자리 수와 vi.waitFor 이중 배율 수를 출력
//
// 바인딩 해석(B) — 식별자는 TypeScript 검사기 심볼로 같은 파일 스코프 규칙대로 선언에 닿는다(가림·이름 충돌 포함).
//   B1 래퍼 ( ) · as · satisfies · <T> · ! → 안쪽
//   B2 변수 선언 const/let/var x = e → e. 같은 파일의 대입 x = e′ · x ??= e′ · x ||= e′ 도 후보(여러 값)
//   B3 구조 분해(변수·매개변수) — 기본값 + 원천이 객체/배열 리터럴로 풀리면 그 멤버
//   B4 같은 파일 함수(function 선언 · 변수/속성에 담은 화살표·함수 식 · 객체·클래스 메서드)
//      — 매개변수 → 기본값 + 같은 파일 호출부의 같은 위치 인자 · 호출 결과 → 그 함수의 반환식
//   B5 단축 속성 { x } → x 의 해석
//   B6 멤버 접근 o.k · o['k'] — o 가 객체 리터럴로 풀리면 그 멤버(전개 포함)
//   B7 ?? · || 양쪽 · 조건식 양쪽 · 리터럴 산술 + - * / · scaleMs(…) 는 배율
//   호출 대상(callee)도 B1·B2 로 풀고 promisify(x)/util.promisify(x) 는 x, child_process·timers/promises import 별칭은 원래 이름.
//   경계(따라가지 않음): 같은 파일 선언에 닿지 않는 호출(라이브러리·production)의 인자→매개변수와 그 콜백 매개변수 ·
//   import(테스트 소스의 export 는 그 파일에서 자리로 센다) · 객체 리터럴로 풀리지 않는 값의 멤버 · 계산 키.
// now 식 — Date.now() · performance.now() · new Date().getTime() · new Date().valueOf() 와, B 해석·산술로 그것에 닿는 식.
//   호출 인자·객체·배열 안의 now 는 보지 않는다. now 식끼리의 비교는 자리가 아니다.
// 맥락(사용 자리) — 슬롯·객체가 변수 X 의 초기값 안에 있으면 X 의 참조 자리마다 맥락을 본다(함수 인자·반환은 넘지 않는다).
//   제외: 참조 ≥1 이고 **전부** 제외 자리 · 자식 프로세스 무임계 / timeout 이름 객체: 참조 **하나라도**.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const app = resolve(process.argv[2] ?? '.')
const argv = process.argv.slice(3)
const all = argv.includes('--all')
const ts = createRequire(join(app, 'package.json'))('typescript')
const MIN_MS = 1000
const CHILD_PROCESS = new Set(['execFile', 'execFileSync', 'spawn', 'spawnSync', 'exec', 'execSync', 'fork'])
const TIMEOUT_NAME = /timeout/i
const TEST_CALLS = new Set(['it', 'test', 'describe', 'bench', 'suite'])
const HOOK_CALLS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])
const UPPER = new Set(['toBeLessThan', 'toBeLessThanOrEqual'])
const UPPER_INV = new Set(['toBeGreaterThan', 'toBeGreaterThanOrEqual'])
const K = ts.SyntaxKind
const COMPARE = new Set([K.LessThanToken, K.LessThanEqualsToken, K.GreaterThanToken, K.GreaterThanEqualsToken])
const ASSIGN = new Set([K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken])
const ARITH = new Set([K.PlusToken, K.MinusToken, K.AsteriskToken, K.SlashToken])

const list = (d) =>
  readdirSync(d).flatMap((e) => {
    const f = join(d, e)
    if (statSync(f).isDirectory()) return e === 'node_modules' ? [] : list(f)
    return /\.test\.ts$|\.testfixture\.tsx?$/.test(e) ? [f] : []
  })

function program(rel, text) {
  const opts = { noLib: true, noResolve: true, allowJs: false, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, types: [] }
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const host = {
    getSourceFile: (n) => (n === rel ? sf : undefined),
    writeFile() {},
    getDefaultLibFileName: () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (n) => n,
    getCurrentDirectory: () => '/',
    getNewLine: () => '\n',
    fileExists: (n) => n === rel,
    readFile: () => undefined
  }
  const p = ts.createProgram([rel], opts, host)
  return { src: p.getSourceFile(rel), checker: p.getTypeChecker() }
}

const unwrap = (n) => {
  while (
    n &&
    (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) ||
      ts.isTypeAssertionExpression(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)))
  )
    n = n.expression
  return n
}
const nameText = (name) =>
  !name ? '' : ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)
    ? name.text
    : ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression) ? name.expression.text : ''

export function scanDeadlines(rel, text) {
  const { src, checker } = program(rel, text)
  const line = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
  const rootOf = (expr) => {
    let e = expr
    while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e)) e = e.expression
    return ts.isIdentifier(e) ? e.text : null
  }
  const isCallTo = (n, name) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name

  // 심볼 → 참조 식별자 목록 · 대입 값 목록 · (함수 심볼) 호출 목록
  const refs = new Map()
  const assigns = new Map()
  const calls = new Map()
  const promiseTimers = new Set()
  const childAliases = new Set()
  const symOf = (id) => {
    const s = checker.getSymbolAtLocation(id)
    return s
  }
  const declOf = (sym) => sym?.valueDeclaration ?? sym?.declarations?.[0]
  const collect = (node) => {
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const isDeclName = p && (p.name === node) && (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertyAccessExpression(p))
      if (!isDeclName && !(p && ts.isBindingElement(p) && p.propertyName === node)) {
        const s = ts.isShorthandPropertyAssignment(p) && p.name === node ? checker.getShorthandAssignmentValueSymbol(p) : symOf(node)
        if (s) (refs.get(s) ?? refs.set(s, []).get(s)).push(node)
      }
    }
    if (ts.isBinaryExpression(node) && ASSIGN.has(node.operatorToken.kind) && ts.isIdentifier(node.left)) {
      const s = symOf(node.left)
      if (s) (assigns.get(s) ?? assigns.set(s, []).get(s)).push(node.right)
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      const id = ts.isIdentifier(callee) ? callee : ts.isPropertyAccessExpression(callee) ? callee.name : null
      const d = id && declOf(symOf(id))
      if (d) (calls.get(d) ?? calls.set(d, []).get(d)).push(node)
    }
    if (
      ts.isImportDeclaration(node) &&
      /^(node:)?timers\/promises$/.test(node.moduleSpecifier.text) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    )
      for (const el of node.importClause.namedBindings.elements)
        if ((el.propertyName ?? el.name).text === 'setTimeout') promiseTimers.add(el.name.text)
    if (
      ts.isImportDeclaration(node) &&
      /^(node:)?child_process$/.test(node.moduleSpecifier.text) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    )
      for (const el of node.importClause.namedBindings.elements)
        if (CHILD_PROCESS.has((el.propertyName ?? el.name).text)) childAliases.add(el.name.text)
    ts.forEachChild(node, collect)
  }
  collect(src)
  const refsOf = (sym) => (refs.get(sym) ?? []).filter((r) => !(ts.isBinaryExpression(r.parent) && ASSIGN.has(r.parent.operatorToken.kind) && r.parent.left === r))

  // 함수 노드 → 그 함수 이름 심볼(이름 있는 함수만)
  // 함수 노드 → 호출 목록의 키(이름이 붙은 선언 노드)
  const fnSymbol = (fn) => {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return fn
    let d = fn.parent
    while (d && (ts.isParenthesizedExpression(d) || ts.isAsExpression(d))) d = d.parent
    if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && d && (ts.isVariableDeclaration(d) || ts.isPropertyAssignment(d) || ts.isPropertyDeclaration(d)) && unwrap(d.initializer) === fn)
      return d
    return null
  }
  // 함수 선언(같은 파일) → 반환식
  const returnsOf = (fn) => {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body]
    const out = []
    const walk = (n) => {
      if (n !== fn && ts.isFunctionLike(n)) return
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression)
      ts.forEachChild(n, walk)
    }
    if (fn.body) walk(fn.body)
    return out
  }
  const fnOfSymbol = (sym) => {
    const d = declOf(sym)
    if (!d) return null
    if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d
    if ((ts.isVariableDeclaration(d) || ts.isPropertyAssignment(d) || ts.isPropertyDeclaration(d)) && d.initializer && (ts.isArrowFunction(unwrap(d.initializer)) || ts.isFunctionExpression(unwrap(d.initializer)))) return unwrap(d.initializer)
    return null
  }
  // 객체/배열 리터럴 식에서 멤버 값 노드 목록
  const memberBusy = new Set()
  const memberOf = (objExprs, key) =>
    objExprs.flatMap((o) => {
      o = unwrap(o)
      if (ts.isObjectLiteralExpression(o)) {
        const mk = `${o.pos}:${key}`
        if (memberBusy.has(mk)) return []
        memberBusy.add(mk)
        const out = []
        for (const p of o.properties) {
          if (ts.isPropertyAssignment(p) && nameText(p.name) === key) out.push(p.initializer)
          else if (ts.isShorthandPropertyAssignment(p) && p.name.text === key) out.push(p.name)
          else if (ts.isSpreadAssignment(p)) out.push(...memberOf(exprsOf(p.expression), key))
        }
        memberBusy.delete(mk)
        return out
      }
      if (ts.isArrayLiteralExpression(o) && /^\d+$/.test(key)) return o.elements[Number(key)] ? [o.elements[Number(key)]] : []
      return []
    })
  const callArgs = (fn, idx) => {
    const sym = fnSymbol(fn)
    if (!sym || idx < 0) return []
    return (calls.get(sym) ?? []).map((c) => c.arguments[idx]).filter(Boolean)
  }
  // 식 → 같은 값이 될 수 있는 원천 식 목록(바인딩을 끝까지 푼다). 더 풀 수 없으면 자신, 경계면 빈 목록.
  const memo = new Map()
  const busy = new Set()
  function exprsOf(node) {
    node = unwrap(node)
    if (!node) return []
    if (memo.has(node)) return memo.get(node)
    if (busy.has(node)) return []
    busy.add(node)
    const out = [...new Set(rawExprs(node))]
    busy.delete(node)
    memo.set(node, out)
    return out
  }
  function rawExprs(node) {
    const short = node.parent && ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
    if (ts.isIdentifier(node)) {
      const sym = short ? checker.getShorthandAssignmentValueSymbol(node.parent) : symOf(node)
      const decl = declOf(sym)
      if (!decl) return []
      if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name))
        return [...(decl.initializer ? exprsOf(decl.initializer) : []), ...(assigns.get(sym) ?? []).flatMap((a) => exprsOf(a))]
      if (ts.isBindingElement(decl)) return bindingSources(decl)
      if (ts.isParameter(decl) && ts.isIdentifier(decl.name))
        return [...(decl.initializer ? exprsOf(decl.initializer) : []), ...callArgs(decl.parent, decl.parent.parameters?.indexOf(decl) ?? -1).flatMap((x) => exprsOf(x))]
      return [] // import · 함수 · 클래스 · 그 밖 — 경계
    }
    if (ts.isPropertyAccessExpression(node)) return memberOf(exprsOf(node.expression), node.name.text).flatMap((m) => exprsOf(m))
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
      return memberOf(exprsOf(node.expression), node.argumentExpression.text).flatMap((m) => exprsOf(m))
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === K.QuestionQuestionToken || node.operatorToken.kind === K.BarBarToken))
      return [...exprsOf(node.left), ...exprsOf(node.right)]
    if (ts.isConditionalExpression(node)) return [...exprsOf(node.whenTrue), ...exprsOf(node.whenFalse)]
    if (ts.isCallExpression(node) && !isCallTo(node, 'scaleMs')) {
      const callee = unwrap(node.expression)
      const id = ts.isIdentifier(callee) ? callee : ts.isPropertyAccessExpression(callee) ? callee.name : null
      const fn = id && fnOfSymbol(symOf(id))
      if (fn) return returnsOf(fn).flatMap((r) => exprsOf(r))
    }
    return [node]
  }
  function bindingSources(el) {
    const out = el.initializer ? exprsOf(el.initializer) : []
    const pattern = el.parent
    const key = ts.isArrayBindingPattern(pattern) ? String(pattern.elements.indexOf(el)) : nameText(el.propertyName ?? el.name)
    const owner = pattern.parent
    let outer = []
    if (ts.isVariableDeclaration(owner) && owner.initializer) outer = exprsOf(owner.initializer)
    else if (ts.isParameter(owner))
      outer = [...(owner.initializer ? exprsOf(owner.initializer) : []), ...callArgs(owner.parent, owner.parent.parameters?.indexOf(owner) ?? -1).flatMap((x) => exprsOf(x))]
    else if (ts.isBindingElement(owner)) outer = bindingSources(owner)
    if (key) out.push(...memberOf(outer, key).flatMap((m) => exprsOf(m)))
    return out
  }

  // 값 해석 → [{ literal, value, scaled }]
  const valMemo = new Map()
  const resolveValues = (node) => {
    if (valMemo.has(node)) return valMemo.get(node)
    valMemo.set(node, [])
    const out = []
    for (const e of exprsOf(node)) {
      if (ts.isNumericLiteral(e)) out.push({ literal: e, value: Number(e.text.replace(/_/g, '')), scaled: false })
      else if (isCallTo(e, 'scaleMs')) out.push({ literal: e, value: null, scaled: true })
      else if (ts.isBinaryExpression(e) && ARITH.has(e.operatorToken.kind)) {
        const l = resolveValues(e.left)
        const r = resolveValues(e.right)
        if (l.some((x) => x.scaled) || r.some((x) => x.scaled)) out.push({ literal: e, value: null, scaled: true })
        else if (l.length === 1 && r.length === 1) {
          const k = e.operatorToken.kind
          const x = l[0].value
          const y = r[0].value
          out.push({ literal: e, value: k === K.PlusToken ? x + y : k === K.MinusToken ? x - y : k === K.AsteriskToken ? x * y : x / y, scaled: false })
        }
      }
    }
    valMemo.set(node, out)
    return out
  }
  const nowSource = (e) => {
    e = unwrap(e)
    if (!e || !ts.isCallExpression(e)) return false
    const t = e.expression.getText(src).replace(/\s+/g, '')
    return t === 'Date.now' || t === 'performance.now' || /^\(?newDate\(\)\)?\.(getTime|valueOf)$/.test(t)
  }
  // now 식 — now 원천, 또는 B 해석·산술(+ - * /)로 now 원천에 닿는 식. 호출 인자·객체·배열 안은 보지 않는다.
  const nowMemo = new Map()
  const mentionsNow = (node) => {
    node = unwrap(node)
    if (!node) return false
    if (nowMemo.has(node)) return nowMemo.get(node)
    nowMemo.set(node, false)
    let hit = nowSource(node)
    if (!hit && ts.isBinaryExpression(node) && ARITH.has(node.operatorToken.kind)) hit = mentionsNow(node.left) || mentionsNow(node.right)
    if (!hit && (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isConditionalExpression(node) || (ts.isBinaryExpression(node) && !ARITH.has(node.operatorToken.kind))))
      hit = exprsOf(node).some((e) => e !== node && mentionsNow(e))
    nowMemo.set(node, hit)
    return hit
  }

  // 사용 자리: node 가 바인딩 X 의 초기값 안에 있으면 X 의 참조 자리들(재귀). 아니면 [node].
  const usesOf = (node, depth = 0, seen = new Set()) => {
    if (depth > 10) return [node]
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const sym = symOf(node.name)
      if (!sym || seen.has(sym)) return []
      seen.add(sym)
      const rs = refsOf(sym)
      return rs.length ? rs.flatMap((r) => usesOf(r, depth + 1, seen)) : [node]
    }
    let top = node
    for (let p = node.parent; p; top = p, p = p.parent) {
      if (ts.isVariableDeclaration(p) && p.initializer === top && ts.isIdentifier(p.name)) {
        const sym = symOf(p.name)
        if (!sym || seen.has(sym)) return []
        seen.add(sym)
        const rs = refsOf(sym)
        if (!rs.length) return [node]
        return rs.flatMap((r) => usesOf(r, depth + 1, seen))
      }
      if (ts.isStatement(p) || ts.isFunctionLike(p) || ts.isCallExpression(p) || ts.isNewExpression(p)) break
      if (!(ts.isObjectLiteralExpression(p) || ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isSpreadAssignment(p) || ts.isArrayLiteralExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(p)))) break
    }
    return [node]
  }
  const excludedAt = (node, keepMatcher) => {
    for (let child = node, p = node.parent; p; child = p, p = p.parent) {
      if (!ts.isCallExpression(p)) continue
      const argIndex = p.arguments.indexOf(child)
      if (argIndex < 0) continue
      const callee = calleeText(p)
      if (callee === 'scaleMs' || callee === 'scaledBudget' || callee === 'vi.setConfig') return true
      if (callee === 'vi.waitFor' && argIndex >= 1) return true
      const root = rootOf(p.expression)
      if (root && (TEST_CALLS.has(root) || HOOK_CALLS.has(root))) {
        const afterFn = p.arguments.slice(0, argIndex).some((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a))
        if (afterFn || ts.isObjectLiteralExpression(child)) return true
      }
      if (!keepMatcher && root === 'expect' && !isCallTo(p, 'expect')) return true
    }
    return false
  }
  const excluded = (slot, keepMatcher) => {
    const uses = usesOf(slot)
    return uses.length > 0 && uses.every((u) => excludedAt(u, keepMatcher))
  }
  // 객체 리터럴의 사용 자리 중 하나라도 pred
  const objectUses = (obj) => usesOf(obj)
  const inTimeoutObject = (prop) => {
    const check = (object, depth = 0) => {
      if (!object || depth > 10 || !ts.isObjectLiteralExpression(object)) return false
      for (const use of objectUses(object)) {
        let o = use
        let owner = o.parent
        while (owner && (ts.isParenthesizedExpression(owner) || ts.isAsExpression(owner))) owner = owner.parent
        if (!owner) continue
        if ((ts.isPropertyAssignment(owner) || ts.isShorthandPropertyAssignment(owner) || ts.isVariableDeclaration(owner)) && TIMEOUT_NAME.test(nameText(owner.name))) return true
        if (ts.isPropertyAssignment(owner) || ts.isShorthandPropertyAssignment(owner)) {
          if (check(owner.parent, depth + 1)) return true
        }
      }
      return false
    }
    return check(prop.parent)
  }
  const objUsesOfNode = (obj) => {
    obj = unwrap(obj)
    if (ts.isIdentifier(obj)) {
      const sym = symOf(obj)
      return sym ? refsOf(sym).flatMap((r) => usesOf(r)) : []
    }
    return usesOf(obj)
  }
  const childProcessOption = (prop) =>
    objUsesOfNode(prop.parent).some((u) => {
      let o = u
      while (o.parent && (ts.isSpreadAssignment(o.parent) || ts.isObjectLiteralExpression(o.parent) || ts.isParenthesizedExpression(o.parent))) o = o.parent
      const call = o.parent
      if (!call || !ts.isCallExpression(call) || !call.arguments.includes(o)) return false
      const t = calleeText(call)
      return CHILD_PROCESS.has(t.split('.').pop())
    })

  // 호출 대상 판정용 원문 — callee 를 B1·B2 로 풀고 promisify(x) 는 x 로 본다.
  const calleeText = (call) => {
    let e = unwrap(call.expression)
    for (let i = 0; i < 5; i++) {
      if (ts.isCallExpression(e) && /^(util\.)?promisify$/.test(e.expression.getText(src)) && e.arguments[0]) { e = unwrap(e.arguments[0]); continue }
      if (ts.isIdentifier(e)) {
        const d = declOf(symOf(e))
        if (d && ts.isVariableDeclaration(d) && d.initializer && !(assigns.get(symOf(e)) ?? []).length) {
          const init = unwrap(d.initializer)
          if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init) || (ts.isCallExpression(init) && /^(util\.)?promisify$/.test(init.expression.getText(src)))) { e = init; continue }
        }
      }
      break
    }
    const t = e.getText(src).replace(/\s+/g, '')
    return childAliases.has(t) ? 'execFile' : t
  }
  const seen = new Set()
  const sites = []
  const unresolved = []
  const push = (kind, at, valueNode) => {
    if (!valueNode || excluded(at, kind === 'elapsed')) return
    const vs = resolveValues(valueNode)
    if (!vs.length) {
      const srcs = exprsOf(valueNode)
      const v0 = unwrap(valueNode)
      let why = 'other'
      const nonTime = (e) => ts.isObjectLiteralExpression(e) || ts.isStringLiteralLike(e) || ts.isTemplateExpression(e) || ts.isArrowFunction(e) || ts.isFunctionExpression(e) || ts.isNewExpression(e) || ts.isArrayLiteralExpression(e) || e.kind === K.TrueKeyword || e.kind === K.FalseKeyword || ts.isCallExpression(e)
      if (srcs.length && srcs.every(nonTime)) why = 'non-time(' + [...new Set(srcs.map((e) => ts.isCallExpression(e) ? 'call:' + e.expression.getText(src).slice(0, 30) : K[e.kind]))].join('|') + ')'
      else if (ts.isIdentifier(v0) || ts.isShorthandPropertyAssignment(at)) {
        const id = ts.isShorthandPropertyAssignment(at) ? at.name : v0
        const sym = ts.isShorthandPropertyAssignment(at) ? checker.getShorthandAssignmentValueSymbol(at) : symOf(id)
        const d = declOf(sym)
        why = !d ? 'no-decl' : ts.isImportSpecifier(d) || ts.isImportClause(d) ? 'import:' + (d.parent?.parent?.parent?.moduleSpecifier?.text ?? '?') : ts.isParameter(d) ? 'param-of-unnamed-fn' : ts.isFunctionDeclaration(d) ? 'function' : K[d.kind]
      } else if (ts.isPropertyAccessExpression(v0)) why = 'member-of-nonliteral'
      else if (ts.isCallExpression(v0)) why = 'call-result'
      unresolved.push({ kind, why, line: line(at), text: at.getText(src).replace(/\s+/g, ' ').slice(0, 90) })
      return
    }
    const objOfSlot =
      ts.isPropertyAssignment(at) || ts.isShorthandPropertyAssignment(at)
        ? at
        : ts.isBinaryExpression(at) && (ts.isPropertyAccessExpression(at.left) || ts.isElementAccessExpression(at.left))
          ? { parent: at.left.expression }
          : null
    const noThreshold = kind === 'abort' || (kind === 'option' && objOfSlot && childProcessOption(objOfSlot))
    for (const v of vs) {
      if (!v.scaled && !all && !noThreshold && v.value < MIN_MS) continue
      const key = v.literal.getStart(src)
      if (seen.has(key)) continue
      seen.add(key)
      sites.push({ kind, line: line(at), valueLine: line(v.literal), value: v.scaled ? 'scaleMs' : v.literal.getText(src), scaled: v.scaled, literal: v.literal, text: at.getText(src).replace(/\s+/g, ' ').slice(0, 90) })
    }
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = calleeText(node)
      const pa = ts.isPropertyAccessExpression(node.expression) ? node.expression : null
      if (/^(globalThis\.|window\.)?(setTimeout|setInterval)$/.test(callee)) push('timer', node, node.arguments[1])
      else if (promiseTimers.has(callee)) push('timer', node, node.arguments[0])
      else if (/\.setTimeout$/.test(callee)) push('method', node, node.arguments[0])
      else if (callee === 'AbortSignal.timeout') push('abort', node, node.arguments[0])
      else if (pa && ts.isCallExpression(pa.expression) && isCallTo(pa.expression, 'expect')) {
        const subject = pa.expression.arguments[0]
        const m = pa.name.text
        if (UPPER.has(m) && mentionsNow(subject)) push('elapsed', node, node.arguments[0])
        else if (UPPER_INV.has(m) && node.arguments[0] && mentionsNow(node.arguments[0]) && !mentionsNow(subject)) push('elapsed', node, subject)
      }
    }
    if (ts.isBinaryExpression(node)) {
      const k = node.operatorToken.kind
      const ln = mentionsNow(node.left)
      const rn = mentionsNow(node.right)
      if ((k === K.PlusToken || k === K.PlusEqualsToken) && ln && !rn) push('deadline', node, node.right)
      else if (k === K.PlusToken && rn && !ln) push('deadline', node, node.left)
      else if (COMPARE.has(k) && ln && !rn) push('deadline', node, node.right)
      else if (COMPARE.has(k) && rn && !ln) push('deadline', node, node.left)
      // 대입 슬롯 o.timeoutMs = v · timeoutMs = v
      if (ASSIGN.has(k)) {
        const l = node.left
        const nm = ts.isPropertyAccessExpression(l) ? l.name.text : ts.isElementAccessExpression(l) && ts.isStringLiteralLike(l.argumentExpression) ? l.argumentExpression.text : ts.isIdentifier(l) ? l.text : ''
        const ownerName = (ts.isPropertyAccessExpression(l) || ts.isElementAccessExpression(l)) ? (rootOf(l.expression) ?? '') : ''
        if (TIMEOUT_NAME.test(nm) || TIMEOUT_NAME.test(ownerName)) push(ts.isIdentifier(l) ? 'named' : 'option', node, node.right)
      }
    }
    if (ts.isPropertyAssignment(node) && (TIMEOUT_NAME.test(nameText(node.name)) || inTimeoutObject(node))) push('option', node, node.initializer)
    if (ts.isShorthandPropertyAssignment(node) && (TIMEOUT_NAME.test(node.name.text) || inTimeoutObject(node))) push('option', node, node.name)
    if (ts.isPropertyDeclaration(node) && TIMEOUT_NAME.test(nameText(node.name)) && node.initializer) push('option', node, node.initializer)
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && TIMEOUT_NAME.test(node.name.text)) push('param', node, node.initializer)
    if (ts.isBindingElement(node) && TIMEOUT_NAME.test(nameText(node.propertyName ?? node.name)) && node.initializer) push('param', node, node.initializer)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && TIMEOUT_NAME.test(node.name.text) && node.initializer) push('named', node, node.initializer)
    ts.forEachChild(node, visit)
  }
  visit(src)
  // P7′ — vi.waitFor 옵션(둘째 이후 인자)이 바인딩을 거쳐 scaleMs 에 닿는가
  const scaleMemo = new Map()
  const reachesScale = (n) => {
    n = unwrap(n)
    if (!n) return false
    if (scaleMemo.has(n)) return scaleMemo.get(n)
    scaleMemo.set(n, false)
    let hit = isCallTo(n, 'scaleMs')
    if (!hit && (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n) || ts.isConditionalExpression(n) || ts.isBinaryExpression(n)))
      hit = exprsOf(n).some((e) => e !== n && reachesScale(e))
    if (!hit && !ts.isFunctionLike(n)) hit = ts.forEachChild(n, (c) => (reachesScale(c) ? true : undefined)) ?? false
    if (!hit && ts.isShorthandPropertyAssignment(n)) hit = exprsOf(n.name).some((e) => reachesScale(e))
    scaleMemo.set(n, hit)
    return hit
  }
  const doubles = []
  const vw = (n) => {
    if (ts.isCallExpression(n) && calleeText(n) === 'vi.waitFor')
      for (const a of n.arguments.slice(1)) if (reachesScale(a)) doubles.push({ line: line(a) })
    ts.forEachChild(n, vw)
  }
  vw(src)
  return { sites, unresolved, src, doubles }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (argv.includes('--probe')) {
    const input = JSON.parse(readFileSync(0, 'utf8'))
    for (const { file = 'a.test.ts', code, name } of input) {
      const { sites, doubles } = scanDeadlines(file, code)
      console.log(`${name ?? ''}\t${sites.filter((s) => !s.scaled).length} literal\t${sites.filter((s) => s.scaled).length} scaled\t${doubles.length} waitFor×2\t${sites.map((s) => `${s.kind}:${s.value}`).join(',')}`)
    }
    process.exit(0)
  }
  const rows = []
  const unres = []
  const t0 = Date.now()
  for (const file of list(join(app, 'src')).sort()) {
    const rel = relative(app, file).replaceAll('\\', '/')
    const text = readFileSync(file, 'utf8')
    const fake = /useFakeTimers\s*\(/.test(text) ? 'fake' : '-'
    const { sites, unresolved } = scanDeadlines(rel, text)
    for (const s of sites)
      rows.push(`${s.kind}\t${rel}:${s.line}\t${s.value}\t${s.scaled ? 'scaled' : 'literal'}\t${fake}\t${s.valueLine === s.line ? '-' : `값:${s.valueLine}`}\t${s.text}`)
    for (const u of unresolved) unres.push(`${u.kind}\t${u.why}\t${rel}:${u.line}\t${u.text}`)
  }
  if (argv.includes('--unresolved')) for (const u of unres) console.log(u)
  else for (const row of rows) console.log(row)
  const by = {}
  for (const row of rows) {
    const [kind, , , status] = row.split('\t')
    by[`${kind}/${status}`] = (by[`${kind}/${status}`] ?? 0) + 1
  }
  console.error(JSON.stringify({ total: rows.length, unresolved: unres.length, ms: Date.now() - t0, ...by }))
}
