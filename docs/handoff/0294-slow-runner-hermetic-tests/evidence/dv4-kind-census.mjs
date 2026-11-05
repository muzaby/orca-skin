// 0294 ΔV4 — (H′) 해석기가 식을 읽는 자리마다 트리에 나오는 식 노드 종류를 센다(노드 종류 표의 자리 검색 명령).
// 게이트(app/scripts/check-test-budgets.mjs)와 해석기(test-budget-bindings.mjs)의 임시 사본에 훅을 꽂아
// 게이트가 실제로 보는 자리에서만 센다 — 슬롯 값(V) · 호출 대상(C) · now 피연산자(N). 사본은 os.tmpdir 에만 둔다.
// 사용: node dv4-kind-census.mjs <app 디렉토리> [--list <분류 접두사>] [--probe <코드>]
//   출력: 위치 \t 분류(num|scaled|nonnum|bound|red|form|none) \t 사유 \t 자리 수
//   --list red   red 분류의 자리를 파일:줄로 출력(접두사 일치)
//   --probe      문자열 소스 하나를 판정(분류 표 UT 입력의 실행 확인)
// 분류 정의는 plan §7-E 노드 종류 표가 정본이다. 이 파일은 그 표를 트리에 대 보는 계측이다.
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const appDir = resolve(process.argv[2] ?? '.')
const listIdx = process.argv.indexOf('--list')
const listPrefix = listIdx > 0 ? process.argv[listIdx + 1] : null
const probeIdx = process.argv.indexOf('--probe')
const probeCode = probeIdx > 0 ? process.argv[probeIdx + 1] : null
const ts = createRequire(join(appDir, 'package.json'))('typescript')
const K = ts.SyntaxKind

// ── 사본 + 훅 ────────────────────────────────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'dv4-census-'))
const patch = (text, old, neu) => {
  if (!text.includes(old)) throw new Error(`patch anchor missing: ${old.slice(0, 60)}`)
  return text.replace(old, neu)
}
let bindings = readFileSync(join(appDir, 'scripts/test-budget-bindings.mjs'), 'utf8')
bindings = bindings.replace(/from 'typescript'/, `from '${pathToFileURL(createRequire(join(appDir, 'package.json')).resolve('typescript')).href}'`)
bindings = patch(bindings, '  return {\n    src,\n    sources,', '  return {\n    __internals: { declOf, assignments, callsTo, functionKey, functionOfDecl, returnsOf, argumentsFor, isScaleCall, references },\n    src,\n    sources,')
let gate = readFileSync(join(appDir, 'scripts/check-test-budgets.mjs'), 'utf8')
gate = gate.replace(/from 'typescript'/, `from '${pathToFileURL(createRequire(join(appDir, 'package.json')).resolve('typescript')).href}'`)
gate = patch(gate, "    if (!valueNode || excluded(slot, form === 'elapsed')) return\n", "    if (!valueNode || excluded(slot, form === 'elapsed')) return\n    globalThis.__dv4Slot?.(form, slot, valueNode, b, options)\n")
gate = patch(gate, '  const visit = (node) => {\n    if (ts.isCallExpression(node)) {\n      const callee = calleeOf(node)', '  const visit = (node) => {\n    globalThis.__dv4Node?.(node, b)\n    if (ts.isCallExpression(node)) {\n      const callee = calleeOf(node)')
writeFileSync(join(work, 'test-budget-bindings.mjs'), bindings)
writeFileSync(join(work, 'check-test-budgets.mjs'), gate)
const { scanDeadlineSites } = await import(pathToFileURL(join(work, 'check-test-budgets.mjs')).href)
rmSync(work, { recursive: true, force: true })

// ── 분류 ─────────────────────────────────────────────────────────────────────
const WRAP = (n) => ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isTypeAssertionExpression(n)
const peel = (n) => { while (n && WRAP(n)) n = n.expression; return n }
const NONNUM_GLOBAL = new Set(['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask'])
const HANDLE_CALL = /^(globalThis\.|window\.)?(setTimeout|setInterval|setImmediate)$|^vi\.(fn|spyOn|mocked)$/
const NONNUM_KINDS = new Set([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateExpression, K.RegularExpressionLiteral, K.TrueKeyword, K.FalseKeyword, K.NullKeyword, K.ObjectLiteralExpression, K.ArrayLiteralExpression, K.FunctionExpression, K.ArrowFunction, K.ClassExpression, K.JsxElement, K.JsxSelfClosingElement, K.JsxFragment, K.TypeOfExpression, K.VoidExpression, K.DeleteExpression, K.BigIntLiteral, K.NewExpression])

/** ΔV4 가 새로 푸는 경로 표시 — 그 경로로 닿은 num·scaled 단말은 why 에 '@new' 를 붙인다(트리의 새 자리 측정). */
const viaNew = (parts) => parts.map((p) => (p.c === 'num' || p.c === 'scaled' ? { ...p, why: `${p.why}@new` } : p))
/** 값 식 → 단말 분류 목록 [{c, why}] — c: num | scaled | nonnum | bound | red. */
function classify(b, expr, seen = new Set()) {
  const I = b.__internals
  const node = peel(expr)
  if (!node) return [{ c: 'nonnum', why: 'empty' }]
  if (seen.has(node)) return []
  seen.add(node)
  const src = b.src
  const k = node.kind
  if (k === K.NumericLiteral) return [{ c: 'num', why: 'literal' }]
  if (ts.isPrefixUnaryExpression(node)) {
    if ((node.operator === K.MinusToken || node.operator === K.PlusToken) && ts.isNumericLiteral(peel(node.operand))) return viaNew([{ c: 'num', why: 'unary-literal' }])
    if (node.operator === K.ExclamationToken) return [{ c: 'nonnum', why: 'not' }]
    return [{ c: 'red', why: `unary:${K[node.operator]}` }]
  }
  if (NONNUM_KINDS.has(k)) return [{ c: 'nonnum', why: K[k] }]
  if (ts.isCallExpression(node) && I.isScaleCall(node)) return [{ c: 'scaled', why: 'scaleMs' }]
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if ([K.PlusToken, K.MinusToken, K.AsteriskToken, K.SlashToken].includes(op)) {
      const parts = [...classify(b, node.left, seen), ...classify(b, node.right, seen)]
      if (parts.some((p) => p.c === 'red')) return parts.filter((p) => p.c === 'red')
      if (parts.some((p) => p.c === 'bound')) return parts.filter((p) => p.c === 'bound')
      return [{ c: parts.some((p) => p.c === 'scaled') ? 'scaled' : 'num', why: 'arith' }]
    }
    if (op === K.QuestionQuestionToken || op === K.BarBarToken) return [...classify(b, node.left, seen), ...classify(b, node.right, seen)]
    if (op === K.AmpersandAmpersandToken) return viaNew(classify(b, node.right, seen))
    if (op === K.CommaToken) return viaNew(classify(b, node.right, seen))
    if ([K.LessThanToken, K.LessThanEqualsToken, K.GreaterThanToken, K.GreaterThanEqualsToken, K.EqualsEqualsToken, K.EqualsEqualsEqualsToken, K.ExclamationEqualsToken, K.ExclamationEqualsEqualsToken, K.InKeyword, K.InstanceOfKeyword].includes(op)) return [{ c: 'nonnum', why: 'boolean-op' }]
    return [{ c: 'red', why: `op:${K[op]}` }]
  }
  if (ts.isConditionalExpression(node)) return [...classify(b, node.whenTrue, seen), ...classify(b, node.whenFalse, seen)]
  if (ts.isIdentifier(node)) {
    const decl = I.declOf(node)
    if (!decl) {
      if (node.text === 'undefined') return [{ c: 'nonnum', why: 'undefined' }]
      if (node.text === 'Infinity' || node.text === 'NaN') return [{ c: 'nonnum', why: node.text }]
      if (NONNUM_GLOBAL.has(node.text)) return [{ c: 'nonnum', why: 'global-fn' }]
      return [{ c: 'bound', why: 'lib-global' }]
    }
    if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && ts.isCatchClause(decl.parent)) return [{ c: 'red', why: 'catch-var' }]
    if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Ambient) return [{ c: 'bound', why: 'ambient' }]
    if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
      const list = decl.parent
      if (list && ts.isVariableDeclarationList(list) && list.parent && (ts.isForOfStatement(list.parent) || ts.isForInStatement(list.parent))) return [{ c: 'red', why: 'loop-var' }]
      const compound = (I.references.get(decl) ?? []).some((r) => ts.isBinaryExpression(r.parent) && r.parent.left === r && [K.PlusEqualsToken, K.MinusEqualsToken, K.AsteriskEqualsToken, K.SlashEqualsToken].includes(r.parent.operatorToken.kind))
      const out = []
      if (compound) out.push({ c: 'red', why: 'compound-assign' })
      if (decl.initializer) out.push(...classify(b, decl.initializer, seen))
      for (const v of I.assignments.get(decl) ?? []) out.push(...classify(b, v, seen))
      if (!out.length) out.push({ c: 'nonnum', why: 'no-value' })
      return out
    }
    if (ts.isBindingElement(decl)) return classifyBinding(b, decl, seen)
    if (ts.isParameter(decl) && ts.isIdentifier(decl.name)) return classifyParam(b, decl, seen)
    if (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl)) return [{ c: 'bound', why: 'import' }]
    if (ts.isFunctionDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl) || ts.isMethodDeclaration(decl)) return [{ c: 'nonnum', why: `decl:${K[decl.kind]}` }]
    return [{ c: 'red', why: `decl:${K[decl.kind]}` }]
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    let key = null
    if (ts.isPropertyAccessExpression(node)) key = node.name.text
    else if (ts.isStringLiteralLike(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) key = node.argumentExpression.text
    if (key === null) return [{ c: 'red', why: 'computed-key' }]
    return classifyMember(b, node.expression, key, seen)
  }
  if (ts.isCallExpression(node)) {
    const callee = peel(node.expression)
    if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) return viaNew(I.returnsOf(callee).flatMap((e) => classify(b, e, seen)))
    const id = ts.isIdentifier(callee) ? callee : ts.isPropertyAccessExpression(callee) ? callee.name : null
    const fn = id && I.functionOfDecl(I.declOf(id))
    if (fn) return I.returnsOf(fn).flatMap((e) => classify(b, e, seen))
    const text = b.calleeName(node)
    if (HANDLE_CALL.test(text)) return [{ c: 'nonnum', why: 'handle-or-mock' }]
    if (/^vi\.(fn|spyOn|mocked)\(/.test(peel(node.expression).getText(b.src).replace(/\s+/g, ''))) return [{ c: 'nonnum', why: 'mock-chain' }]
    return [{ c: 'red', why: `call-result` }]
  }
  if (k === K.AwaitExpression) return [{ c: 'red', why: 'await' }]
  if (k === K.ThisKeyword) return [{ c: 'red', why: 'this' }]
  return [{ c: 'red', why: `kind:${K[k]}` }]
}
function classifyParam(b, param, seen) {
  const I = b.__internals
  const fn = param.parent
  const out = param.initializer ? classify(b, param.initializer, seen) : []
  const key = I.functionKey(fn)
  const pos = fn.parameters ? fn.parameters.indexOf(param) : -1
  const calls = key ? I.callsTo.get(key) ?? [] : []
  for (const call of calls) if (call.arguments[pos]) out.push(...classify(b, call.arguments[pos], seen))
  let owner = fn.parent
  while (owner && WRAP(owner)) owner = owner.parent
  if (owner && ts.isCallExpression(owner) && peel(owner.expression) === fn) {
    if (owner.arguments[pos]) out.push(...viaNew(classify(b, owner.arguments[pos], seen)))
    return out.length ? out : [{ c: 'nonnum', why: 'iife-no-arg' }]
  }
  if (calls.length === 0) {
    // 함수 값이 인자로 넘어가거나 객체·클래스 속성·배열 요소·반환값으로 저장되면 호출자가 같은 파일 밖이다(경계).
    const stored = owner && (ts.isCallExpression(owner) || ts.isNewExpression(owner) || ts.isPropertyAssignment(owner) || ts.isPropertyDeclaration(owner) || ts.isArrayLiteralExpression(owner) || ts.isReturnStatement(owner) || ts.isJsxExpression(owner))
    if (stored) out.push({ c: 'bound', why: 'callback-param' })
    else if (!param.initializer) out.push({ c: 'red', why: 'param-no-caller' })
  }
  return out
}
function classifyBinding(b, element, seen) {
  const out = element.initializer ? classify(b, element.initializer, seen) : []
  const pattern = element.parent
  const key = ts.isArrayBindingPattern(pattern) ? String(pattern.elements.indexOf(element)) : (element.propertyName ?? element.name).getText(b.src).replace(/^['"]|['"]$/g, '')
  const holder = pattern.parent
  if (ts.isVariableDeclaration(holder) && holder.initializer) out.push(...classifyMember(b, holder.initializer, key, seen))
  else if (ts.isParameter(holder)) {
    const I = b.__internals
    const fn = holder.parent
    const fkey = I.functionKey(fn)
    const pos = fn.parameters.indexOf(holder)
    const calls = fkey ? I.callsTo.get(fkey) ?? [] : []
    for (const call of calls) if (call.arguments[pos]) out.push(...classifyMember(b, call.arguments[pos], key, seen))
    if (!calls.length) out.push(...classifyParam(b, holder, seen).filter((p) => p.c !== 'nonnum').map((p) => (p.c === 'red' ? p : { c: 'bound', why: `member-of-${p.why}` })))
  } else if (ts.isBindingElement(holder)) out.push(...classifyBinding(b, holder, seen).filter((p) => p.c === 'bound' || p.c === 'red'), ...nestedMember(b, holder, key, seen))
  if (!out.length) out.push({ c: 'nonnum', why: 'no-value' })
  return out
}
/** 중첩 구조 분해 — 바깥 요소가 푼 객체 리터럴의 key 멤버. */
function nestedMember(b, outer, key, seen) {
  const outerKey = (outer.propertyName ?? outer.name).getText(b.src)
  const holder = outer.parent.parent
  if (ts.isVariableDeclaration(holder) && holder.initializer) {
    const owners = b.sources(holder.initializer).map(peel).filter(ts.isObjectLiteralExpression)
    const inner = owners.flatMap((o) => o.properties.filter((p) => ts.isPropertyAssignment(p) && p.name.getText(b.src) === outerKey).map((p) => p.initializer))
    return inner.flatMap((e) => classifyMember(b, e, key, seen))
  }
  return [{ c: 'red', why: 'nested-binding' }]
}
function classifyMember(b, ownerExpr, key, seen) {
  if (peel(ownerExpr).kind === K.ThisKeyword) {
    let cls = ownerExpr.parent
    while (cls && !ts.isClassLike(cls)) cls = cls.parent
    const member = cls?.members.find((m) => ts.isPropertyDeclaration(m) && m.name.getText(b.src) === key)
    if (member?.initializer) return viaNew(classify(b, member.initializer, seen))
    return [{ c: 'red', why: 'this-member' }]
  }
  const owners = b.sources(ownerExpr)
  const out = []
  if (!owners.length) {
    const oc = classify(b, ownerExpr, new Set(seen))
    for (const p of oc) out.push(p.c === 'bound' ? { c: 'bound', why: `member-of-${p.why}` } : p.c === 'red' ? { c: 'red', why: `member-of-${p.why}` } : { c: 'red', why: `member-of-nonobject` })
    return out
  }
  for (const raw of owners) {
    const o = peel(raw)
    if (ts.isObjectLiteralExpression(o)) {
      let found = false
      for (const prop of o.properties) {
        const name = prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) || ts.isNumericLiteral(prop.name)) ? prop.name.text : null
        if (ts.isPropertyAssignment(prop) && name === key) { found = true; out.push(...classify(b, prop.initializer, seen)) }
        else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === key) { found = true; out.push(...classify(b, prop.name, seen)) }
        else if (ts.isSpreadAssignment(prop)) { const sub = classifyMember(b, prop.expression, key, seen); if (sub.some((p) => p.why !== 'missing-member')) { found = true; out.push(...sub) } }
        else if ((ts.isMethodDeclaration(prop) || ts.isGetAccessorDeclaration(prop)) && name === key) { found = true; out.push({ c: ts.isMethodDeclaration(prop) ? 'nonnum' : 'red', why: ts.isMethodDeclaration(prop) ? 'method' : 'getter' }) }
      }
      if (!found) out.push({ c: 'nonnum', why: 'missing-member' })
    } else if (ts.isArrayLiteralExpression(o) && /^\d+$/.test(key)) {
      const el = o.elements[Number(key)]
      out.push(...(el ? viaNew(classify(b, el, seen)) : [{ c: 'nonnum', why: 'missing-member' }]))
    } else if (ts.isArrayLiteralExpression(o) || ts.isStringLiteralLike(o)) out.push({ c: 'red', why: `literal-builtin-member` })
    else {
      const oc = classify(b, o, new Set(seen))
      for (const p of oc) out.push(p.c === 'bound' ? { c: 'bound', why: `member-of-${p.why}` } : { c: 'red', why: `member-of-${p.c}:${p.why}` })
    }
  }
  return out
}

/** 호출 대상 분류 — form(형태 호출 대상 이름) | none(형태 아님) | red(형태 이름이 후보에 있으나 해석 불가). */
const FORM_NAME = /^((globalThis|window)\.)?(setTimeout|setInterval)$|\.setTimeout$|^AbortSignal\.timeout$|^vi\.waitFor$|(^|\.)(execFile|execFileSync|spawn|spawnSync|exec|execSync|fork)$/
function classifyCallee(b, call) {
  const I = b.__internals
  const c = peel(call.expression)
  const name = b.calleeName(call)
  if (FORM_NAME.test(name)) return { c: 'form', why: 'resolved' }
  if (ts.isIdentifier(c)) {
    const decl = I.declOf(c)
    if (decl && ts.isBindingElement(decl)) {
      const prop = (decl.propertyName ?? decl.name).getText(b.src)
      const holder = decl.parent.parent
      const owner = ts.isVariableDeclaration(holder) && holder.initializer ? peel(holder.initializer).getText(b.src) : '?'
      return FORM_NAME.test(`${owner}.${prop}`) || FORM_NAME.test(prop) ? { c: 'form', why: 'destructured(L05)' } : { c: 'none', why: 'destructured' }
    }
    if (decl && ts.isVariableDeclaration(decl) && (I.assignments.get(decl) ?? []).length) {
      const cands = [decl.initializer, ...(I.assignments.get(decl) ?? [])].filter(Boolean).map((e) => peel(e).getText(b.src).replace(/\s+/g, ''))
      return cands.some((t) => FORM_NAME.test(t)) ? { c: 'red', why: 'reassigned-form(L11)' } : { c: 'none', why: 'reassigned' }
    }
    if (decl && ts.isParameter(decl)) return { c: 'none', why: 'param' }
    return { c: 'none', why: decl ? `ident:${K[decl.kind]}` : 'global' }
  }
  if (ts.isElementAccessExpression(c)) {
    if (ts.isStringLiteralLike(c.argumentExpression)) return FORM_NAME.test(`${peel(c.expression).getText(b.src)}.${c.argumentExpression.text}`) ? { c: 'form', why: 'element-string(L06)' } : { c: 'none', why: 'element-string' }
    return { c: 'none', why: 'element-computed' }
  }
  if (ts.isPropertyAccessExpression(c)) {
    const owner = peel(c.expression)
    if (ts.isIdentifier(owner)) {
      const d = I.declOf(owner)
      if (d && ts.isVariableDeclaration(d) && d.initializer && !(I.assignments.get(d) ?? []).length) {
        const via = `${peel(d.initializer).getText(b.src)}.${c.name.text}`
        if (FORM_NAME.test(via)) return { c: 'form', why: 'owner-alias' }
      }
    }
    return { c: 'none', why: 'member' }
  }
  if (ts.isArrowFunction(c) || ts.isFunctionExpression(c)) return { c: 'none', why: 'iife(L03→B4)' }
  if (ts.isCallExpression(c)) return { c: 'none', why: 'call-of-call' }
  return { c: 'none', why: `kind:${K[c.kind]}` }
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const counts = new Map()
const lines = []
const bump = (pos, p, at) => {
  const key = `${pos}\t${p.c}\t${p.why}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
  if (listPrefix && `${pos}:${p.c}`.startsWith(listPrefix)) lines.push(`${key}\t${at}`)
}
let rel = 'a.test.ts'
const lineOf = (b, n) => `${rel}:${b.src.getLineAndCharacterOfPosition(n.getStart(b.src)).line + 1}`
globalThis.__dv4Slot = (form, slot, valueNode, b) => {
  const parts = classify(b, valueNode)
  const uniq = new Map(parts.map((p) => [`${p.c}\t${p.why}`, p]))
  for (const p of uniq.values()) bump(`V(${form})`, p, `${lineOf(b, slot)} ${slot.getText(b.src).replace(/\s+/g, ' ').slice(0, 70)}`)
}
globalThis.__dv4Node = (node, b) => {
  if (ts.isBindingElement(node) && node.initializer && ts.isObjectLiteralExpression(peel(node.initializer)) && /timeout/i.test((node.propertyName ?? node.name).getText(b.src)))
    bump('O', { c: 'form', why: 'binding-default-owner(O04)' }, lineOf(b, node))
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(getTime|valueOf)$/.test(node.expression.name.text) && node.arguments.length === 0) {
    const target = peel(node.expression.expression)
    if (ts.isIdentifier(target)) {
      const d = b.__internals.declOf(target)
      const init = d && ts.isVariableDeclaration(d) && d.initializer && peel(d.initializer)
      if (init && ts.isNewExpression(init) && init.expression.getText(b.src) === 'Date' && !(init.arguments?.length)) bump('N', { c: 'form', why: 'date-var-clock(N05)' }, `${lineOf(b, node)} ${node.parent.getText(b.src).slice(0, 60)}`)
    }
  }
  if (ts.isCallExpression(node)) {
    const r = classifyCallee(b, node)
    bump('C', r, `${lineOf(b, node)} ${node.expression.getText(b.src).slice(0, 50)}`)
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    const deadlineOp = [K.PlusToken, K.PlusEqualsToken, K.LessThanToken, K.LessThanEqualsToken, K.GreaterThanToken, K.GreaterThanEqualsToken].includes(op)
    if (!deadlineOp) return
    const big = (e) => b.values(e).some((v) => v.scaled || v.value >= 1000)
    const leftNow = b.isNow(node.left)
    const rightNow = b.isNow(node.right)
    if (leftNow || rightNow) return
    for (const [num, other] of [[node.right, node.left], [node.left, node.right]]) {
      if (!big(num)) continue
      const oc = classify(b, other)
      const worst = oc.find((p) => p.c === 'red') ?? oc.find((p) => p.c === 'bound') ?? oc[0]
      if (worst) bump('N', worst, `${lineOf(b, node)} ${node.getText(b.src).replace(/\s+/g, ' ').slice(0, 70)}`)
    }
  }
}
if (probeCode !== null) {
  scanDeadlineSites('a.test.ts', probeCode)
} else {
  const root = join(appDir, 'src')
  const walk = (d) => readdirSync(d).flatMap((e) => (statSync(join(d, e)).isDirectory() ? walk(join(d, e)) : /\.test\.ts$|\.testfixture\.tsx?$/.test(e) ? [join(d, e)] : []))
  for (const f of walk(root)) {
    rel = f.slice(root.length + 1).split(/[\\/]/).join('/')
    scanDeadlineSites(rel, readFileSync(f, 'utf8'))
  }
}
for (const [key, n] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`${key}\t${n}`)
for (const l of lines) console.log(`  ${l}`)
