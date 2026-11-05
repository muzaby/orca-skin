// 0294 ΔV3 — 판정이 바뀌는 분기(F04)와 EP-12c 열거 밖 형태(L01~L03·L05~L09·L11) 가 현재 테스트 소스에 몇 자리인가.
// 형태는 문법으로 넓게 센다(과대 근사) — 0 이면 그 형태의 트리 자리가 없다. 0 이 아니면 자리를 줄로 출력한다.
// 산술 조합(V33~V35)·래퍼(L04)·복합 대입(L10)은 문법 수가 잡음이라 실험 사본 게이트로 잰다(dv3-experiment.sh).
// 사용: node dv3-tree-scan.mjs <app 디렉토리>
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const appDir = resolve(process.argv[2] ?? '.')
const ts = createRequire(join(appDir, 'package.json'))('typescript')
const { createBindings } = await import(
  pathToFileURL(join(appDir, 'scripts/test-budget-bindings.mjs')).href
)
const peel = (node) => {
  let n = node
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isTypeAssertionExpression(n)))
    n = n.expression
  return n
}
const K = ts.SyntaxKind
const BUDGET_FILE = /\.test\.ts$|\.testfixture\.tsx?$/
const TIMEOUT = /timeout/i
const CALLEE_NAMES = new Set([
  'setTimeout', 'setInterval', 'waitFor', 'timeout',
  'execFile', 'execFileSync', 'spawn', 'spawnSync', 'exec', 'execSync', 'fork'
])
const FORM_CALLEE =
  /^((globalThis|window)\.)?(setTimeout|setInterval)$|\.setTimeout$|^AbortSignal\.timeout$|^vi\.waitFor$|(^|\.)(execFile|execFileSync|spawn|spawnSync|exec|execSync|fork)$|promisify/
const UPPER = new Set(['toBeLessThan', 'toBeLessThanOrEqual', 'toBeGreaterThan', 'toBeGreaterThanOrEqual'])

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (BUDGET_FILE.test(entry)) files.push(full)
  }
}
walk(join(appDir, 'src'))

const FORMS = {
  F04: 'timers/promises 의 setTimeout 을 별칭 없이 import',
  L11: '재대입되는 호출 대상 변수의 후보에 형태의 호출 대상이 있음(재대입 호출 전체 수는 첫 줄)',
  L01: '클래스 필드 /timeout/i 이름 = 객체 리터럴(W3)',
  L02: '대입 대상 /timeout/i 이름 = 객체 리터럴(W3b)',
  L03: '즉시 호출 함수(IIFE) + 인자(W7)',
  L05: '구조 분해로 꺼낸 호출 대상 이름(W4b·W4c·W4d)',
  L06: '요소 접근 호출 대상(W10)',
  L07: '같은 파일 now 헬퍼의 직접 호출(W5)',
  L08: '.not + 상한·하한 matcher(W6)',
  L09: '기본값 없는 /timeout/i 매개변수(W8)'
}
const hits = Object.fromEntries(Object.keys(FORMS).map((k) => [k, []]))

for (const full of files) {
  const rel = full.slice(appDir.length + 1).split(/[\\/]/).join('/')
  const source = readFileSync(full, 'utf8')
  const b = createBindings(rel, source)
  const { src } = b
  const at = (node) => `${rel}:${src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1}`
  // 이름 → 그 이름의 초기값·대입 우변 원문(이름 기준 과대 근사 — 스코프를 가르지 않는다).
  const reassigned = new Map()
  const candidates = new Map()
  const addCandidate = (name, expr) => {
    const list = candidates.get(name) ?? []
    list.push(peel(expr).getText(src).replace(/\s+/g, ''))
    candidates.set(name, list)
  }
  const visitAssign = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === K.EqualsToken && ts.isIdentifier(node.left)) {
      reassigned.set(node.left.text, true)
      addCandidate(node.left.text, node.right)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      addCandidate(node.name.text, node.initializer)
    ts.forEachChild(node, visitAssign)
  }
  visitAssign(src)
  for (const st of src.statements) {
    if (!ts.isImportDeclaration(st) || !/^(node:)?timers\/promises$/.test(st.moduleSpecifier.text)) continue
    const named = st.importClause?.namedBindings
    if (named && ts.isNamedImports(named))
      for (const el of named.elements)
        if (!el.propertyName && el.name.text === 'setTimeout') hits.F04.push(at(el))
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = peel(node.expression)
      // L11 — 재대입되는 호출 대상 변수의 후보(초기값·대입 값) 중 형태의 호출 대상 이름이 있는가.
      if (ts.isIdentifier(callee) && reassigned.has(callee.text)) {
        const names = candidates.get(callee.text) ?? []
        hits.L11all = (hits.L11all ?? 0) + 1
        if (names.some((n) => FORM_CALLEE.test(n))) hits.L11.push(`${at(node)} ${callee.text} ← ${names.join(' | ')}`)
      }
      if ((ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) && node.arguments.length > 0)
        hits.L03.push(at(node))
      if (
        ts.isElementAccessExpression(callee) &&
        ts.isStringLiteralLike(callee.argumentExpression) &&
        CALLEE_NAMES.has(callee.argumentExpression.text)
      )
        hits.L06.push(`${at(node)} ${callee.getText(src).slice(0, 40)}`)
      // now 헬퍼 직접 호출 — 같은 파일 함수의 반환이 now 식이고, 호출 자체가 now 식으로 보이지 않는다.
      const resolved = b.sources(node)
      if (resolved.length > 0 && resolved[0] !== node && resolved.some((s) => b.isNow(s)) && !b.isNow(node))
        hits.L07.push(`${at(node)} ${node.getText(src).slice(0, 40)}`)
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        UPPER.has(node.expression.name.text) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === 'not'
      )
        hits.L08.push(`${at(node)} ${node.getText(src).slice(0, 50)}`)
    }
    if (ts.isPropertyDeclaration(node) && TIMEOUT.test(node.name.getText(src)) && node.initializer && ts.isObjectLiteralExpression(peel(node.initializer)))
      hits.L01.push(at(node))
    if (
      ts.isBinaryExpression(node) &&
      [K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken].includes(node.operatorToken.kind) &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
      TIMEOUT.test(ts.isPropertyAccessExpression(node.left) ? node.left.name.text : node.left.argumentExpression.getText(src)) &&
      ts.isObjectLiteralExpression(peel(node.right))
    )
      hits.L02.push(at(node))
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = (node.propertyName ?? node.name).getText(src)
      if (CALLEE_NAMES.has(name)) hits.L05.push(`${at(node)} ${node.parent.parent.getText(src).slice(0, 50)}`)
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && TIMEOUT.test(node.name.text) && !node.initializer)
      hits.L09.push(`${at(node)} ${node.name.text}`)
    ts.forEachChild(node, visit)
  }
  visit(src)
}

console.log(`파일 ${files.length} · 재대입되는 변수를 호출 대상으로 부르는 호출 ${hits.L11all ?? 0}`)
delete hits.L11all
for (const [id, label] of Object.entries(FORMS)) {
  console.log(`${id}\t${hits[id].length}\t${label}`)
  for (const h of hits[id]) console.log(`  ${h}`)
}
