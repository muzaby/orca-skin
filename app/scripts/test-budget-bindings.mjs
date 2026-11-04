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
// 경계 — 같은 파일 선언에 닿지 않는 호출(production·라이브러리)의 인자와 그 콜백 매개변수 ·
//   import(테스트 소스의 export 는 그 파일에서 자리가 된다) · 객체 리터럴로 풀리지 않는 값의 멤버 ·
//   계산 키. 경계에 닿으면 빈 목록 — 자리로 세지 않는다.
import ts from 'typescript'

const K = ts.SyntaxKind
const ASSIGN_OPS = new Set([K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken])
export const ARITH_OPS = new Set([K.PlusToken, K.MinusToken, K.AsteriskToken, K.SlashToken])

/** 값에 영향이 없는 래퍼를 벗긴다. */
export function peel(node) {
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
  const file = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, kind)
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
      : checker.getSymbolAtLocation(id)
    return declOfSymbol(symbol)
  }

  // 선언 노드 → 참조 식별자 · 대입 우변 · 호출 노드. 키가 선언 노드인 이유: 메서드·속성의
  // 심볼은 위치마다 다른 객체로 돌아올 수 있어 심볼 동일성으로는 묶이지 않는다.
  const references = new Map()
  const assignments = new Map()
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
    if (!key || position < 0) return out
    for (const call of callsTo.get(key) ?? [])
      if (call.arguments[position]) out.push(call.arguments[position])
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
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
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
    if (ts.isCallExpression(node)) {
      const id = calleeId(node)
      const fn = id && functionOfDecl(declOf(id))
      if (fn && !isScaleCall(node)) return returnsOf(fn).flatMap((e) => sources(e))
    }
    return [node]
  }

  const isScaleCall = (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'scaleMs'

  const valueMemo = new Map()
  /** 식 → 숫자 값 후보 `{ literal, value, scaled }` 목록(여러 값이면 여럿). */
  function values(expression) {
    const node = peel(expression)
    if (!node) return []
    if (valueMemo.has(node)) return valueMemo.get(node)
    valueMemo.set(node, [])
    const out = []
    for (const s of sources(node)) {
      if (ts.isNumericLiteral(s))
        out.push({ literal: s, value: Number(s.text.replace(/_/g, '')), scaled: false })
      else if (isScaleCall(s)) out.push({ literal: s, value: null, scaled: true })
      else if (ts.isBinaryExpression(s) && ARITH_OPS.has(s.operatorToken.kind)) {
        const left = values(s.left)
        const right = values(s.right)
        if ([...left, ...right].some((v) => v.scaled))
          out.push({ literal: s, value: null, scaled: true })
        else if (left.length === 1 && right.length === 1) {
          const [a, b] = [left[0].value, right[0].value]
          const op = s.operatorToken.kind
          const value =
            op === K.PlusToken
              ? a + b
              : op === K.MinusToken
                ? a - b
                : op === K.AsteriskToken
                  ? a * b
                  : a / b
          out.push({ literal: s, value, scaled: false })
        }
      }
    }
    valueMemo.set(node, out)
    return out
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
      ts.isNewExpression(target) &&
      ts.isIdentifier(target.expression) &&
      target.expression.text === 'Date' &&
      (target.arguments?.length ?? 0) === 0
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
        ts.isBinaryExpression(node))
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
  function calleeName(call) {
    let e = peel(call.expression)
    for (let hop = 0; hop < 8; hop++) {
      if (ts.isCallExpression(e) && isPromisify(e) && e.arguments[0]) {
        e = peel(e.arguments[0])
        continue
      }
      if (ts.isIdentifier(e)) {
        const decl = declOf(e)
        if (
          decl &&
          ts.isVariableDeclaration(decl) &&
          decl.initializer &&
          !(assignments.get(decl) ?? []).length
        ) {
          const init = peel(decl.initializer)
          if (
            ts.isIdentifier(init) ||
            ts.isPropertyAccessExpression(init) ||
            (ts.isCallExpression(init) && isPromisify(init))
          ) {
            e = init
            continue
          }
        }
      }
      break
    }
    return e.getText(src).replace(/\s+/g, '')
  }
  const isPromisify = (call) =>
    /^(util\.)?promisify$/.test(call.expression.getText(src).replace(/\s+/g, ''))

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
    isNow,
    reachesScale,
    usesOf,
    objectUses,
    calleeName,
    importAliases
  }
}
