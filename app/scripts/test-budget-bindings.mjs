// (H′) 의 **같은 파일 바인딩 해석기** (0294 ΔV2 D-015·D-016).
//
// 게이트가 식을 읽는 모든 자리 — 형태의 호출 대상 · 대상 식(now 식) · 값 · 옵션 객체 · 맥락 —
// 는 이 해석기 하나를 지난다. 문법 노드만 보면 같은 계약을 다른 문법(단축 속성 · const 에 담은
// 옵션 · now 변수 · 구조 분해 기본값)으로 쓴 자리가 게이트를 조용히 지난다(verify r2 D2·D3).
//
// 따라가는 것 — 같은 파일 **선언 그래프**:
//   식별자는 TypeScript 검사기 심볼로 선언에 닿는다(스코프·가림). 래퍼 `( )`·`as`·`satisfies`·`!`.
//   변수 초기값과 같은 파일의 대입(`=`·`??=`·`||=`) · 구조 분해(기본값 + 원천 멤버) · 같은 파일
//   함수·메서드의 매개변수 ← 기본값과 같은 파일 호출부의 같은 위치 인자 · 호출 결과 ← 반환식 ·
//   단축 속성 · 객체 리터럴 멤버(전개 포함) · `??`·`||`·조건식 양쪽.
// ΔV4 노드 종류 표 정본: docs/handoff/0294-slow-runner-hermetic-tests/plan.md §7-E.
// KV01~17 식 · KD01~14 선언 · KM01~09 멤버 · KF01~05 호출 결과는 classify 한 곳에서
// num/scaled/nonnum/bound/red 단말로 판정한다. 표 밖 값은 red(판정 불가)다.
// KC01~13 호출 대상과 KN01~09 now 식은 아래 전용 해석을 쓰며 모르는 종류는 형태/now가 아니다.
// import·lib 전역·밖에서 부르는 콜백·declare는 bound다. 외부 함수의 호출 결과는 KF05 red다.
import ts from 'typescript'

const K = ts.SyntaxKind
const ASSIGN_OPS = new Set([K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken])
const ARITH_OPS = new Set([K.PlusToken, K.MinusToken, K.AsteriskToken, K.SlashToken])

/** 값에 영향이 없는 래퍼를 벗긴다. */
function peel(node) {
  let n = node
  while (
    n &&
    (ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isTypeAssertionExpression(n))
  )
    n = n.expression
  return n
}

/** 속성·바인딩 이름의 문자열. 계산 키는 문자열 리터럴일 때만. */
export function keyOf(name) {
  if (!name) return ''
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text
  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression))
    return name.expression.text
  return ''
}

function singleFileProgram(path, source) {
  // 확장자 없는 이름(단위 테스트의 'a')은 program 이 루트로 받지 않는다 — 내부 이름에만 붙인다.
  const relPath = /\.tsx?$/.test(path) ? path : `${path}.ts`
  const kind = /\.tsx$/.test(relPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(
    relPath,
    source,
    {
      languageVersion: ts.ScriptTarget.Latest,
      // Test snippets are modules too: parse top-level await before binding their declarations.
      setExternalModuleIndicator: (file) => {
        file.externalModuleIndicator = true
      }
    },
    true,
    kind
  )
  const host = {
    getSourceFile: (name) => (name === relPath ? file : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === relPath,
    readFile: () => undefined
  }
  const program = ts.createProgram(
    [relPath],
    { noLib: true, noResolve: true, types: [], jsx: ts.JsxEmit.Preserve },
    host
  )
  return { src: program.getSourceFile(relPath), checker: program.getTypeChecker() }
}

const isFunctionValue = (node) =>
  !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node))

/**
 * 한 소스 파일의 바인딩 그래프. 반환 객체의 함수들은 같은 파일 안에서만 답한다.
 */
export function createBindings(relPath, source) {
  const { src, checker } = singleFileProgram(relPath, source)

  const declOfSymbol = (symbol) => symbol?.valueDeclaration ?? symbol?.declarations?.[0] ?? null
  const isShorthandName = (id) =>
    !!id.parent && ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id
  /** 식별자 → 그 값을 정하는 선언. 단축 속성 `{ x }` 의 x 는 값 쪽 심볼. */
  const declOf = (id) => {
    const symbol = isShorthandName(id)
      ? checker.getShorthandAssignmentValueSymbol(id.parent)
      : (checker.getSymbolAtLocation(id) ??
        (ts.isPropertyAccessExpression(id.parent) && id.parent.name === id
          ? undefined
          : checker.resolveName(
              id.text,
              id,
              ts.SymbolFlags.Value | ts.SymbolFlags.Namespace,
              false
            )))
    return declOfSymbol(symbol)
  }

  // 선언 노드 → 참조 식별자 · 대입 우변 · 호출 노드. 키가 선언 노드인 이유: 메서드·속성의
  // 심볼은 위치마다 다른 객체로 돌아올 수 있어 심볼 동일성으로는 묶이지 않는다.
  const references = new Map()
  const assignments = new Map()
  const compoundAssignments = new Set()
  const callsTo = new Map()
  const add = (map, key, value) => {
    const list = map.get(key)
    if (list) list.push(value)
    else map.set(key, [value])
  }
  const isDeclarationName = (id) => {
    const p = id.parent
    if (!p) return false
    if (ts.isBindingElement(p) && p.propertyName === id) return true
    if (ts.isPropertyAccessExpression(p) && p.name === id) return true
    return (
      p.name === id &&
      (ts.isVariableDeclaration(p) ||
        ts.isParameter(p) ||
        ts.isBindingElement(p) ||
        ts.isFunctionDeclaration(p) ||
        ts.isPropertyAssignment(p) ||
        ts.isPropertyDeclaration(p) ||
        ts.isMethodDeclaration(p) ||
        ts.isClassDeclaration(p))
    )
  }
  const calleeId = (call) => {
    const e = peel(call.expression)
    if (ts.isIdentifier(e)) return e
    if (ts.isPropertyAccessExpression(e)) return e.name
    return null
  }
  const index = (node) => {
    if (ts.isIdentifier(node) && !isDeclarationName(node)) {
      const decl = declOf(node)
      const p = node.parent
      const isAssignTarget =
        ts.isBinaryExpression(p) && ASSIGN_OPS.has(p.operatorToken.kind) && p.left === node
      if (decl && !isAssignTarget) add(references, decl, node)
    }
    if (
      ts.isBinaryExpression(node) &&
      ASSIGN_OPS.has(node.operatorToken.kind) &&
      ts.isIdentifier(node.left)
    ) {
      const decl = declOf(node.left)
      if (decl) add(assignments, decl, node.right)
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= K.FirstCompoundAssignment &&
      node.operatorToken.kind <= K.LastCompoundAssignment &&
      !ASSIGN_OPS.has(node.operatorToken.kind) &&
      ts.isIdentifier(node.left)
    ) {
      const decl = declOf(node.left)
      if (decl) compoundAssignments.add(decl)
    }
    if (ts.isCallExpression(node)) {
      const id = calleeId(node)
      const decl = id && declOf(id)
      if (decl) add(callsTo, decl, node)
    }
    ts.forEachChild(node, index)
  }
  index(src)

  /** 함수 값 노드 → 호출 목록의 키(이름이 붙은 선언). */
  const functionKey = (fn) => {
    if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) return fn
    let owner = fn.parent
    while (owner && (ts.isParenthesizedExpression(owner) || ts.isAsExpression(owner)))
      owner = owner.parent
    if (
      isFunctionValue(fn) &&
      owner &&
      (ts.isVariableDeclaration(owner) ||
        ts.isPropertyAssignment(owner) ||
        ts.isPropertyDeclaration(owner)) &&
      peel(owner.initializer) === fn
    )
      return owner
    return null
  }
  /** 선언 → 그 선언이 담은 같은 파일 함수(없으면 null). */
  const functionOfDecl = (decl) => {
    if (!decl) return null
    if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) return decl
    if (
      (ts.isVariableDeclaration(decl) ||
        ts.isPropertyAssignment(decl) ||
        ts.isPropertyDeclaration(decl)) &&
      isFunctionValue(peel(decl.initializer))
    )
      return peel(decl.initializer)
    return null
  }
  const returnsOf = (fn) => {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body]
    const out = []
    const walk = (n) => {
      if (n !== fn.body && ts.isFunctionLike(n)) return
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression)
      ts.forEachChild(n, walk)
    }
    if (fn.body) walk(fn.body)
    return out
  }
  /** 매개변수 → 기본값 + 같은 파일 호출부의 같은 위치 인자. */
  const argumentsFor = (param) => {
    const fn = param.parent
    const key = functionKey(fn)
    const position = fn.parameters ? fn.parameters.indexOf(param) : -1
    const out = param.initializer ? [param.initializer] : []
    if (position < 0) return out
    let outer = fn
    while (outer.parent && peel(outer.parent) === fn) outer = outer.parent
    const immediate = ts.isCallExpression(outer.parent) && outer.parent.expression === outer
    const calls = immediate ? [outer.parent] : (callsTo.get(key) ?? [])
    for (const call of calls) if (call.arguments[position]) out.push(call.arguments[position])
    return out
  }

  const memberBusy = new Set()
  /** 원천 식들 중 객체·배열 리터럴의 key 멤버 값 식. */
  const membersOf = (owners, key) => {
    const out = []
    for (const raw of owners) {
      const owner = peel(raw)
      if (ts.isArrayLiteralExpression(owner)) {
        if (/^\d+$/.test(key) && owner.elements[Number(key)]) out.push(owner.elements[Number(key)])
        continue
      }
      if (!ts.isObjectLiteralExpression(owner)) continue
      const busyKey = `${owner.pos}:${key}`
      if (memberBusy.has(busyKey)) continue
      memberBusy.add(busyKey)
      for (const prop of owner.properties) {
        if (ts.isPropertyAssignment(prop) && keyOf(prop.name) === key) out.push(prop.initializer)
        else if (ts.isShorthandPropertyAssignment(prop) && prop.name.text === key)
          out.push(prop.name)
        else if (ts.isSpreadAssignment(prop)) out.push(...membersOf(sources(prop.expression), key))
      }
      memberBusy.delete(busyKey)
    }
    return out
  }
  const bindingElementSources = (element) => {
    const out = element.initializer ? sources(element.initializer) : []
    const pattern = element.parent
    const key = ts.isArrayBindingPattern(pattern)
      ? String(pattern.elements.indexOf(element))
      : keyOf(element.propertyName ?? element.name)
    const holder = pattern.parent
    let owners = []
    if (ts.isVariableDeclaration(holder) && holder.initializer) owners = sources(holder.initializer)
    else if (ts.isParameter(holder)) owners = argumentsFor(holder).flatMap((e) => sources(e))
    else if (ts.isBindingElement(holder)) owners = bindingElementSources(holder)
    if (key) for (const member of membersOf(owners, key)) out.push(...sources(member))
    return out
  }

  const sourceMemo = new Map()
  const sourceBusy = new Set()
  /**
   * 식 → 같은 값이 될 수 있는 원천 식 목록(바인딩을 끝까지 푼다).
   * 더 풀 수 없는 식은 자기 자신, 경계에 닿은 식별자는 빈 목록이다.
   */
  function sources(expression) {
    const node = peel(expression)
    if (!node) return []
    if (sourceMemo.has(node)) return sourceMemo.get(node)
    if (sourceBusy.has(node)) return []
    sourceBusy.add(node)
    const out = [...new Set(expand(node))]
    sourceBusy.delete(node)
    sourceMemo.set(node, out)
    return out
  }
  function expand(node) {
    if (ts.isIdentifier(node)) {
      const decl = declOf(node)
      if (!decl) return []
      if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
        const out = decl.initializer ? sources(decl.initializer) : []
        for (const value of assignments.get(decl) ?? []) out.push(...sources(value))
        return out
      }
      if (ts.isBindingElement(decl)) return bindingElementSources(decl)
      if (ts.isParameter(decl) && ts.isIdentifier(decl.name))
        return argumentsFor(decl).flatMap((e) => sources(e))
      return []
    }
    if (ts.isPropertyAccessExpression(node))
      return membersOf(sources(node.expression), node.name.text).flatMap((e) => sources(e))
    if (
      ts.isElementAccessExpression(node) &&
      (ts.isStringLiteralLike(node.argumentExpression) ||
        ts.isNumericLiteral(node.argumentExpression))
    )
      return membersOf(sources(node.expression), node.argumentExpression.text).flatMap((e) =>
        sources(e)
      )
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === K.QuestionQuestionToken ||
        node.operatorToken.kind === K.BarBarToken)
    )
      return [...sources(node.left), ...sources(node.right)]
    if (ts.isConditionalExpression(node))
      return [...sources(node.whenTrue), ...sources(node.whenFalse)]
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === K.AmpersandAmpersandToken ||
        node.operatorToken.kind === K.CommaToken)
    )
      return sources(node.right)
    if (ts.isCallExpression(node)) {
      const fn = calledFunction(node)
      if (fn && !isScaleCall(node)) return returnsOf(fn).flatMap((e) => sources(e))
    }
    return [node]
  }

  const isScaleCall = (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'scaleMs'

  const calledFunction = (call) => {
    const target = peel(call.expression)
    if (isFunctionValue(target)) return target
    const id = calleeId(call)
    return id ? functionOfDecl(declOf(id)) : null
  }
  const terminal = (kind, cell, node, value) => ({ kind, cell, node, value })
  const one = (kind, cell, node, value) => [terminal(kind, cell, node, value)]
  const classifyMemo = new Map()
  /** EP-12d KV/KD/KM/KF. Only num/scaled terminals become ordinary deadline values. */
  function classify(expression) {
    const node = peel(expression)
    if (!node) return []
    if (classifyMemo.has(node)) return classifyMemo.get(node)
    classifyMemo.set(node, []) // recursive declarations terminate at the current edge
    const result = classifyNode(node)
    classifyMemo.set(node, result)
    return result
  }
  function classifyNode(node) {
    if (ts.isNumericLiteral(node)) return one('num', 'KV01', node, Number(node.text))
    if (isScaleCall(node)) return one('scaled', 'KV03', node)
    if (ts.isIdentifier(node)) return classifyIdentifier(node)
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      return classifyMember(node)
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (ARITH_OPS.has(op)) {
        const left = classify(node.left)
        const right = classify(node.right)
        const out = [...left, ...right].filter((v) => v.kind === 'red')
        for (const a of left)
          for (const b of right) {
            if (a.kind === 'scaled' || b.kind === 'scaled')
              out.push(terminal('scaled', 'KV05', node))
            else if (a.kind === 'num' && b.kind === 'num') {
              const value =
                op === K.PlusToken
                  ? a.value + b.value
                  : op === K.MinusToken
                    ? a.value - b.value
                    : op === K.AsteriskToken
                      ? a.value * b.value
                      : a.value / b.value
              out.push(terminal('num', 'KV05', node, value))
            }
          }
        return out
      }
      if (op === K.QuestionQuestionToken || op === K.BarBarToken)
        return [...classify(node.left), ...classify(node.right)]
      if (op === K.AmpersandAmpersandToken || op === K.CommaToken) return classify(node.right)
      if (
        [
          K.LessThanToken,
          K.LessThanEqualsToken,
          K.GreaterThanToken,
          K.GreaterThanEqualsToken,
          K.EqualsEqualsToken,
          K.EqualsEqualsEqualsToken,
          K.ExclamationEqualsToken,
          K.ExclamationEqualsEqualsToken,
          K.InKeyword,
          K.InstanceOfKeyword
        ].includes(op)
      )
        return one('nonnum', 'KV09', node)
      if (op >= K.FirstAssignment && op <= K.LastAssignment) return one('red', 'KV11', node)
      return one('red', 'KV10', node)
    }
    if (ts.isConditionalExpression(node))
      return [...classify(node.whenTrue), ...classify(node.whenFalse)]
    if (ts.isPrefixUnaryExpression(node)) {
      if (
        (node.operator === K.PlusToken || node.operator === K.MinusToken) &&
        ts.isNumericLiteral(peel(node.operand))
      )
        return one(
          'num',
          'KV02',
          node,
          Number(peel(node.operand).text) * (node.operator === K.MinusToken ? -1 : 1)
        )
      if (node.operator === K.ExclamationToken) return one('nonnum', 'KV13', node)
      return one('red', 'KV16', node)
    }
    if (ts.isPostfixUnaryExpression(node)) return one('red', 'KV16', node)
    if (ts.isAwaitExpression(node)) return one('red', 'KV14', node)
    if (node.kind === K.ThisKeyword) return one('red', 'KV15', node)
    if (ts.isCallExpression(node)) {
      const fn = calledFunction(node)
      if (fn) return returnsOf(fn).flatMap(classify)
      const name = calleeName(node)
      if (
        /^(globalThis\.|window\.)?(setTimeout|setInterval|setImmediate)$/.test(name) ||
        /^(vi\.(fn|spyOn|mocked))(\(|$|\.)/.test(node.expression.getText(src))
      )
        return one('nonnum', 'KF04', node)
      return one('red', 'KF05', node)
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateExpression(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isBigIntLiteral(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isArrayLiteralExpression(node) ||
      isFunctionValue(node) ||
      ts.isClassExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isTypeOfExpression(node) ||
      ts.isVoidExpression(node) ||
      ts.isDeleteExpression(node) ||
      [K.TrueKeyword, K.FalseKeyword, K.NullKeyword].includes(node.kind)
    )
      return one('nonnum', 'KV13', node)
    return one('red', 'KV17', node)
  }
  function classifyIdentifier(node) {
    const decl = declOf(node)
    if (!decl) {
      const nonnum =
        /^(undefined|Infinity|NaN|setTimeout|setInterval|setImmediate|clearTimeout|clearInterval|clearImmediate)$/.test(
          node.text
        )
      return one(nonnum ? 'nonnum' : 'bound', 'KD12', node)
    }
    if (ts.isVariableDeclaration(decl)) {
      if (ts.isCatchClause(decl.parent)) return one('red', 'KD13', node)
      if (
        ts.isVariableDeclarationList(decl.parent) &&
        (ts.isForOfStatement(decl.parent.parent) || ts.isForInStatement(decl.parent.parent))
      )
        return one('red', 'KD04', node)
      if (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Ambient)
        return one('bound', 'KD03b', node)
      if (compoundAssignments.has(decl)) return one('red', 'KD02', node)
      const candidates = [
        ...(decl.initializer ? [decl.initializer] : []),
        ...(assignments.get(decl) ?? [])
      ]
      return candidates.length ? candidates.flatMap(classify) : one('nonnum', 'KD03', node)
    }
    if (ts.isBindingElement(decl)) {
      const out = bindingElementSources(decl).flatMap(classify)
      let holder = decl.parent.parent
      while (ts.isBindingElement(holder)) holder = holder.parent.parent
      if (!out.length && ts.isParameter(holder) && !argumentsFor(holder).length)
        return one('bound', 'KD08', node)
      return out.length ? out : one('nonnum', 'KD05', node)
    }
    if (ts.isParameter(decl)) {
      const args = argumentsFor(decl)
      if (args.length) return args.flatMap(classify)
      let fn = decl.parent
      let owner = fn.parent
      while (owner && peel(owner) === fn) owner = owner.parent
      const escapes =
        owner &&
        (ts.isCallExpression(owner) ||
          ts.isNewExpression(owner) ||
          ts.isPropertyAssignment(owner) ||
          ts.isPropertyDeclaration(owner) ||
          ts.isArrayLiteralExpression(owner) ||
          ts.isReturnStatement(owner))
      return one(
        escapes || ts.isMethodDeclaration(fn) ? 'bound' : 'red',
        escapes || ts.isMethodDeclaration(fn) ? 'KD08' : 'KD09',
        decl.name
      )
    }
    if (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl))
      return one('bound', 'KD10', node)
    if (ts.isFunctionDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl))
      return one('nonnum', 'KD11', node)
    return one('red', 'KD14', node)
  }
  function classifyMember(node) {
    const arg = ts.isElementAccessExpression(node) ? peel(node.argumentExpression) : null
    const key = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : arg && (ts.isStringLiteralLike(arg) || ts.isNumericLiteral(arg))
        ? arg.text
        : null
    if (key === null) return one('red', 'KM09', node)
    const target = peel(node.expression)
    if (target.kind === K.ThisKeyword) {
      let owner = node.parent
      while (owner && !ts.isClassLike(owner)) owner = owner.parent
      const prop = owner?.members.find((p) => ts.isPropertyDeclaration(p) && keyOf(p.name) === key)
      return prop?.initializer ? classify(prop.initializer) : one('red', 'KM06', node)
    }
    const owners = sources(target)
    if (owners.length) return owners.flatMap((owner) => memberValue(owner, key, node))
    return classify(target).some((v) => v.kind === 'bound')
      ? one('bound', 'KM07', node)
      : one('red', 'KM08', node)
  }
  function memberValue(owner, key, node, busy = new Set()) {
    if (busy.has(owner)) return []
    busy.add(owner)
    if (ts.isObjectLiteralExpression(owner)) {
      const out = []
      for (const prop of owner.properties) {
        if (keyOf(prop.name) === key) {
          if (ts.isPropertyAssignment(prop)) out.push(...classify(prop.initializer))
          else if (ts.isShorthandPropertyAssignment(prop)) out.push(...classify(prop.name))
          else out.push(terminal(ts.isMethodDeclaration(prop) ? 'nonnum' : 'red', 'KM03', node))
        }
        if (ts.isSpreadAssignment(prop))
          for (const source of sources(prop.expression))
            out.push(...memberValue(source, key, node, new Set(busy)))
      }
      return out.length ? out : one('nonnum', 'KM02', node)
    }
    if (ts.isArrayLiteralExpression(owner)) {
      if (/^\d+$/.test(key) && owner.elements[Number(key)])
        return classify(owner.elements[Number(key)])
      return one('red', 'KM05', node)
    }
    if (ts.isStringLiteralLike(owner)) return one('red', 'KM05', node)
    return classify(owner).some((v) => v.kind === 'bound')
      ? one('bound', 'KM07', node)
      : one('red', 'KM08', node)
  }
  /** Numeric view of the same table; no second expression interpreter. */
  function values(expression) {
    return classify(expression)
      .filter((v) => v.kind === 'num' || v.kind === 'scaled')
      .map((v) => ({ literal: v.node, value: v.value, scaled: v.kind === 'scaled' }))
  }

  /** 실시간 원천 4종 — `Date.now()` · `performance.now()` · `new Date().getTime()` · `.valueOf()`. */
  const isClockRead = (expression) => {
    const node = peel(expression)
    if (!node || !ts.isCallExpression(node) || node.arguments.length > 0) return false
    const callee = peel(node.expression)
    if (!ts.isPropertyAccessExpression(callee)) return false
    const method = callee.name.text
    const target = peel(callee.expression)
    if (method === 'now' && ts.isIdentifier(target))
      return target.text === 'Date' || target.text === 'performance'
    return (
      (method === 'getTime' || method === 'valueOf') &&
      sources(target).some(
        (s) =>
          ts.isNewExpression(s) &&
          ts.isIdentifier(s.expression) &&
          s.expression.text === 'Date' &&
          (s.arguments?.length ?? 0) === 0
      )
    )
  }
  const nowMemo = new Map()
  /**
   * now 식 — 실시간 원천, 또는 바인딩·산술(+ - * /)로 원천에 닿는 식.
   * 호출 인자·객체·배열 안의 원천은 그 식을 now 식으로 만들지 않는다.
   */
  function isNow(expression) {
    const node = peel(expression)
    if (!node) return false
    if (nowMemo.has(node)) return nowMemo.get(node)
    nowMemo.set(node, false)
    let result = isClockRead(node)
    if (!result && ts.isBinaryExpression(node) && ARITH_OPS.has(node.operatorToken.kind))
      result = isNow(node.left) || isNow(node.right)
    if (
      !result &&
      (ts.isIdentifier(node) ||
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node) ||
        ts.isConditionalExpression(node) ||
        ts.isBinaryExpression(node) ||
        ts.isCallExpression(node))
    )
      result = sources(node).some((s) => s !== node && isNow(s))
    nowMemo.set(node, result)
    return result
  }

  /** 식이 바인딩을 거쳐 `scaleMs(…)` 에 닿는가 — 함수 몸통 안은 보지 않는다. */
  const scaleMemo = new Map()
  function reachesScale(expression) {
    const node = peel(expression)
    if (!node) return false
    if (scaleMemo.has(node)) return scaleMemo.get(node)
    scaleMemo.set(node, false)
    let result = isScaleCall(node)
    if (!result && !ts.isFunctionLike(node)) {
      const target = ts.isShorthandPropertyAssignment(node) ? node.name : node
      result = sources(target).some((s) => s !== target && reachesScale(s))
      if (!result) result = !!ts.forEachChild(node, (child) => reachesScale(child) || undefined)
    }
    scaleMemo.set(node, result)
    return result
  }

  /**
   * 사용 자리 — 노드가 변수 X 의 초기값 안(객체·배열·래퍼·산술 사이)에 있으면 X 의 참조 자리들
   * (재귀), 아니면 노드 자신. 함수 인자·반환은 넘지 않는다. 참조가 없으면 선언 자리 자신.
   */
  function usesOf(node, seen = new Set()) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
      return referenceUses(node, node, seen)
    let child = node
    for (let p = node.parent; p; child = p, p = p.parent) {
      if (ts.isVariableDeclaration(p) && p.initializer === child && ts.isIdentifier(p.name))
        return referenceUses(p, node, seen)
      const passThrough =
        ts.isObjectLiteralExpression(p) ||
        ts.isArrayLiteralExpression(p) ||
        ts.isPropertyAssignment(p) ||
        ts.isShorthandPropertyAssignment(p) ||
        ts.isSpreadAssignment(p) ||
        ts.isParenthesizedExpression(p) ||
        ts.isAsExpression(p) ||
        ts.isSatisfiesExpression(p) ||
        ts.isConditionalExpression(p) ||
        ts.isBinaryExpression(p)
      if (!passThrough) break
    }
    return [node]
  }
  function referenceUses(decl, self, seen) {
    if (seen.has(decl)) return []
    seen.add(decl)
    const refs = references.get(decl) ?? []
    if (refs.length === 0) return [self]
    return refs.flatMap((ref) => usesOf(ref, seen))
  }
  /** 객체를 가리키는 식(객체 리터럴 또는 식별자)의 사용 자리. */
  function objectUses(expression) {
    const node = peel(expression)
    if (ts.isIdentifier(node)) {
      const decl = declOf(node)
      if (decl && ts.isVariableDeclaration(decl)) return referenceUses(decl, node, new Set())
      return [node]
    }
    return usesOf(node)
  }

  /**
   * 호출 대상 이름 — callee 를 래퍼·변수 별칭(재대입 없는 const)으로 풀고
   * `promisify(x)` · `util.promisify(x)` 는 x 로 본다. 원문 텍스트(공백 제거)를 돌려준다.
   */
  const FORM_NAME =
    /^(?:(?:globalThis|window)\.)?(?:setTimeout|setInterval)$|\.setTimeout$|^AbortSignal\.timeout$|^vi\.(?:waitFor|setConfig)$|^(?:scaleMs|scaledBudget)$|^(?:(?:cp|childProcess)\.)?(?:execFile|execFileSync|spawn|spawnSync|exec|execSync|fork)$/
  const calleeMemo = new Map()
  function calleeTarget(expression, seen = new Set(), asOwner = false) {
    const e = peel(expression)
    if (!e || seen.has(e)) return { name: '', unresolved: false }
    seen = new Set(seen).add(e)
    if (ts.isIdentifier(e)) {
      const decl = declOf(e)
      if (!decl) return { name: e.text, unresolved: false }
      if (ts.isVariableDeclaration(decl)) {
        const candidates = [
          ...(decl.initializer ? [decl.initializer] : []),
          ...(assignments.get(decl) ?? [])
        ]
        if ((assignments.get(decl) ?? []).length || compoundAssignments.has(decl)) {
          const names = candidates.map((c) => calleeTarget(c, seen))
          return { name: '', unresolved: names.some((c) => c.unresolved || FORM_NAME.test(c.name)) }
        }
        return decl.initializer
          ? calleeTarget(decl.initializer, seen, asOwner)
          : { name: '', unresolved: false }
      }
      if (ts.isBindingElement(decl)) {
        const pattern = decl.parent
        const key = keyOf(decl.propertyName ?? decl.name)
        const holder = pattern.parent
        if (ts.isVariableDeclaration(holder) && holder.initializer) {
          const owner = calleeTarget(holder.initializer, seen, true)
          return { name: owner.name ? `${owner.name}.${key}` : '', unresolved: owner.unresolved }
        }
        return { name: '', unresolved: false }
      }
      if (ts.isImportSpecifier(decl)) {
        const module = decl.parent.parent.parent.moduleSpecifier.text
        const original = (decl.propertyName ?? decl.name).text
        if (/^(node:)?timers\/promises$/.test(module))
          return { name: `timers/promises.${original}`, unresolved: false }
        if (/^(node:)?child_process$/.test(module)) return { name: original, unresolved: false }
        if (module === 'vitest' && original === 'vi') return { name: 'vi', unresolved: false }
        if (/\/test-time(?:\.mjs)?$/.test(module) && /^(scaleMs|scaledBudget)$/.test(original))
          return { name: original, unresolved: false }
      }
      // Namespace/default owners keep their public name, while imported functions are opaque.
      if (ts.isNamespaceImport(decl) || ts.isImportClause(decl))
        return { name: asOwner ? e.text : '', unresolved: false }
      return { name: '', unresolved: false }
    }
    if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
      const key = ts.isPropertyAccessExpression(e) ? e.name.text : keyOf(e.argumentExpression)
      if (!key) return { name: '', unresolved: false }
      const owner = calleeTarget(e.expression, seen, true)
      return { name: owner.name ? `${owner.name}.${key}` : '', unresolved: owner.unresolved }
    }
    if (
      ts.isCallExpression(e) &&
      /^(util\.)?promisify$/.test(e.expression.getText(src)) &&
      e.arguments[0]
    )
      return calleeTarget(e.arguments[0], seen)
    return { name: '', unresolved: false }
  }
  function calleeInfo(call) {
    if (!calleeMemo.has(call)) calleeMemo.set(call, calleeTarget(call.expression))
    return calleeMemo.get(call)
  }
  function calleeName(call) {
    return calleeInfo(call).name
  }

  /** import 별칭 → 원래 이름(지정한 모듈에서 가져온 것만). */
  function importAliases(modulePattern) {
    const aliases = new Map()
    for (const statement of src.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      if (!modulePattern.test(statement.moduleSpecifier.text)) continue
      const named = statement.importClause?.namedBindings
      if (!named || !ts.isNamedImports(named)) continue
      for (const element of named.elements)
        aliases.set(element.name.text, (element.propertyName ?? element.name).text)
    }
    return aliases
  }

  return {
    src,
    sources,
    values,
    classify,
    argumentsFor,
    calleeInfo,
    isNow,
    reachesScale,
    usesOf,
    objectUses,
    calleeName,
    importAliases
  }
}
