#!/usr/bin/env node
// 실행 위치·경로 가드 (handoff 0324 D-008·D-028).
//
// 일마다 맡는 프로세스와 경로가 정해져 있다(`docs/arch/execution-model.md`). 이 가드는 그 경로를
// 건너뛴 직접 호출을 막는다 — 규칙 표와 등록 표의 정본은 `ui-thread-rules.mjs` 다.
//
// 모르는 형태는 막는다(fail-closed): 해석하지 못한 import 지정자, 계산된 `import(x)`, 등록 표와
// 다른 개수는 전부 실패다. TypeScript AST 를 쓰지만 순수 Node 라 ABI 와 무관하다.
//
//   node scripts/check-ui-thread.mjs           # 실제 트리 검사
//   node scripts/check-ui-thread.mjs --list    # 규칙별 발견 목록(등록·허용 자리 포함)
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  ALLOWED,
  DOC,
  RULES,
  RULE_IDS,
  SYNC_CLASSES,
  SYNC_REGISTRY,
  TEST_FILE
} from './ui-thread-rules.mjs'

const require = createRequire(import.meta.url)
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Node 가 정한 동기 API 이름 — `fs`·`child_process` export 중 `Sync` 로 끝나는 것. */
export const SYNC_NAMES = new Set(
  [...Object.keys(require('node:fs')), ...Object.keys(require('node:child_process'))].filter(
    (name) => name.endsWith('Sync')
  )
)

const SOURCE = /\.[cm]?tsx?$/
const toPosix = (path) => path.split(sep).join('/')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SOURCE.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function parse(root, file) {
  const text = readFileSync(join(root, file), 'utf8')
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

function visit(node, fn) {
  fn(node)
  ts.forEachChild(node, (child) => visit(child, fn))
}

function importIsTypeOnly(clause) {
  if (!clause) return false // `import 'x'` — 부작용 import 는 값이다.
  if (clause.isTypeOnly) return true
  if (clause.name) return false
  const bindings = clause.namedBindings
  if (!bindings || !ts.isNamedImports(bindings)) return false
  return bindings.elements.length > 0 && bindings.elements.every((el) => el.isTypeOnly)
}

/**
 * 파일의 모듈 참조를 전부 뽑는다 — 정적 import·export-from·동적 `import()`·`require()`·
 * `import x = require()`. 지정자가 문자열 리터럴이 아니면 `specifier: null` 이다(판정 불가).
 */
export function collectImports(sf) {
  const out = []
  const push = (node, specifierNode, typeOnly, names, dynamic = false) => {
    const literal = specifierNode && ts.isStringLiteralLike(specifierNode)
    out.push({
      specifier: literal ? specifierNode.text : null,
      typeOnly,
      names,
      dynamic,
      line: lineOf(sf, node)
    })
  }
  visit(sf, (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      // 이름을 고를 수 없는 형태(default·namespace·부작용)는 `null` — 모든 이름을 가져온 것으로 본다.
      const names =
        clause && !clause.name && bindings && ts.isNamedImports(bindings)
          ? bindings.elements
              .filter((el) => !el.isTypeOnly)
              .map((el) => (el.propertyName ?? el.name).text)
          : null
      push(node, node.moduleSpecifier, importIsTypeOnly(clause), names)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const names =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements
              .filter((el) => !el.isTypeOnly)
              .map((el) => (el.propertyName ?? el.name).text)
          : null
      const typeOnly = node.isTypeOnly || (names !== null && names.length === 0)
      push(node, node.moduleSpecifier, typeOnly, names)
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        push(node, node.moduleReference.expression, node.isTypeOnly, null)
      }
    } else if (ts.isCallExpression(node)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (isImport || isRequire) push(node, node.arguments[0], false, null, true)
    }
  })
  return out
}

const ASSET = /\?[a-z]+$|\.(png|jpe?g|svg|ico|css|sql|json|md|txt|html)$/i

/** 상대 지정자를 `root` 기준 posix 경로로 푼다. 패키지는 `{ package }`, 자산은 `{ asset }`. */
export function resolveSpecifier(root, fromFile, specifier) {
  if (!specifier.startsWith('.')) return { package: specifier }
  if (ASSET.test(specifier)) return { asset: specifier }
  const base = posix.join(posix.dirname(fromFile), specifier)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}/index.ts`,
    `${base}/index.tsx`
  ]) {
    const full = join(root, candidate)
    if (existsSync(full) && statSync(full).isFile()) return { file: candidate }
  }
  if (existsSync(join(root, `${base}.d.ts`))) return { asset: specifier }
  return { unresolved: base }
}

function inAny(file, prefixes) {
  return prefixes.some((prefix) =>
    prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix
  )
}

const packageMatches = (specifier, name) => specifier === name || specifier.startsWith(`${name}/`)

/**
 * 트리를 검사한다. `options.registry`·`options.allowed` 는 테스트가 등록 표를 바꿔 넣는 자리다.
 * 반환값의 `violations` 가 비어 있으면 통과다. `findings` 는 규칙별 발견 전부(허용 자리 포함)다.
 */
export function check(options = {}) {
  const root = options.root ?? APP_ROOT
  const registry = options.registry ?? SYNC_REGISTRY
  const allowed = options.allowed ?? ALLOWED
  const docPath = options.docPath ?? resolve(root, '..', DOC)
  const violations = []
  const findings = Object.fromEntries(RULE_IDS.map((id) => [id, []]))
  const cache = new Map()

  const fail = (rule, file, line, detail) => violations.push({ rule, file, line, detail })
  const found = (rule, file, line, detail, ok) => findings[rule].push({ file, line, detail, ok })
  const load = (file) => {
    if (!cache.has(file)) {
      const sf = parse(root, file)
      cache.set(file, { sf, imports: collectImports(sf) })
    }
    return cache.get(file)
  }
  const listed = (dir) =>
    walk(join(root, dir))
      .map((full) => toPosix(relative(root, full)))
      .filter((file) => !TEST_FILE.test(file))

  const mainFiles = listed('src/main')
  const rendererFiles = listed('src/renderer/src')

  // 해석하지 못한 지정자는 어느 규칙에서든 실패다 — 그 import 가 무엇을 가져오는지 모른다.
  const requireLiteral = (rule, file, imp) => {
    if (imp.specifier !== null) return true
    fail(rule, file, imp.line, '지정자가 문자열 리터럴이 아닌 import — 판정할 수 없다')
    return false
  }

  // ── (a) 동기 API 이름 ──────────────────────────────────────────────────────────────
  const syncCounts = new Map()
  for (const file of mainFiles) {
    const { sf } = load(file)
    visit(sf, (node) => {
      if (!ts.isIdentifier(node) || !SYNC_NAMES.has(node.text)) return
      syncCounts.set(file, (syncCounts.get(file) ?? 0) + 1)
      found('a', file, lineOf(sf, node), node.text, true)
    })
  }
  const registered = new Map(registry.map((entry) => [entry.file, entry]))
  for (const entry of registry) {
    if (!SYNC_CLASSES.includes(entry.class)) {
      fail('a', entry.file, 0, `등록 표의 class 가 ${SYNC_CLASSES.join('·')} 중 하나가 아니다`)
    }
    if (!entry.reason) fail('a', entry.file, 0, '등록 표에 reason 이 없다')
  }
  for (const [file, count] of syncCounts) {
    const entry = registered.get(file)
    if (!entry) fail('a', file, 0, `등록되지 않은 파일에 동기 API 이름 ${count}개`)
    else if (entry.count !== count) {
      fail('a', file, 0, `동기 API 이름 ${count}개 — 등록은 ${entry.count}개`)
    }
  }
  for (const entry of registry) {
    if (!syncCounts.has(entry.file)) {
      fail('a', entry.file, 0, `동기 API 이름 0개 — 등록은 ${entry.count}개(등록을 지운다)`)
    }
  }

  // ── (b) 계산 라이브러리 값 import ───────────────────────────────────────────────────
  for (const file of rendererFiles) {
    for (const imp of load(file).imports) {
      if (!requireLiteral('b', file, imp)) continue
      const lib = allowed.b.modules.find((name) => packageMatches(imp.specifier, name))
      if (!lib || imp.typeOnly) continue
      const ok = inAny(file, allowed.b.anyModule) || inAny(file, allowed.b.byModule[lib] ?? [])
      found('b', file, imp.line, imp.specifier, ok)
      if (!ok) fail('b', file, imp.line, `\`${imp.specifier}\` 값 import`)
    }
  }

  // ── (c) `loadSession` import ────────────────────────────────────────────────────────
  for (const file of mainFiles) {
    for (const imp of load(file).imports) {
      if (!requireLiteral('c', file, imp) || imp.typeOnly) continue
      const target = resolveSpecifier(root, file, imp.specifier)
      if (target.file?.replace(/\.tsx?$/, '') !== allowed.c.module) continue
      // 이름을 고르지 않은 형태(namespace·동적 import)는 `loadSession` 을 가져온 것으로 본다.
      if (imp.names !== null && !imp.names.includes(allowed.c.name)) continue
      const ok = inAny(file, allowed.c.files)
      found('c', file, imp.line, allowed.c.name, ok)
      if (!ok) fail('c', file, imp.line, `\`${allowed.c.name}\` import`)
    }
  }

  // ── (d) `ipcMain` · (g) 창 통지 · (j) `utilityProcess` — 이름으로 본다 ───────────────
  for (const file of mainFiles) {
    const { sf } = load(file)
    visit(sf, (node) => {
      if (ts.isIdentifier(node) && node.text === 'ipcMain') {
        const ok = inAny(file, allowed.d.files)
        found('d', file, lineOf(sf, node), 'ipcMain', ok)
        if (!ok) fail('d', file, lineOf(sf, node), '`ipcMain` 사용')
      }
      if (ts.isIdentifier(node) && node.text === 'utilityProcess') {
        const ok = inAny(file, allowed.j.utilityProcess)
        found('j', file, lineOf(sf, node), 'utilityProcess', ok)
        if (!ok) fail('j', file, lineOf(sf, node), '`utilityProcess` 사용')
      }
      const notify = windowNotify(sf, node)
      if (notify) {
        const ok = inAny(file, allowed.g.files)
        found('g', file, lineOf(sf, node), notify, ok)
        if (!ok) fail('g', file, lineOf(sf, node), `\`${notify}\` 직접 호출`)
      }
    })
  }

  // ── (h) `window.oo` · (i) `Worker` 생성 ─────────────────────────────────────────────
  for (const file of rendererFiles) {
    const { sf } = load(file)
    visit(sf, (node) => {
      if (isWindowOo(node)) {
        const ok = inAny(file, allowed.h.dirs)
        found('h', file, lineOf(sf, node), 'window.oo', ok)
        if (!ok) fail('h', file, lineOf(sf, node), '`window.oo` 접근')
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'Worker' || node.expression.text === 'SharedWorker')
      ) {
        const ok = inAny(file, allowed.i.files)
        found('i', file, lineOf(sf, node), `new ${node.expression.text}`, ok)
        if (!ok) fail('i', file, lineOf(sf, node), `\`new ${node.expression.text}(\``)
      }
    })
  }

  // ── (j) `child_process` · (k) `better-sqlite3` · (f) `worker_threads` — import 로 본다 ─
  for (const file of mainFiles) {
    for (const imp of load(file).imports) {
      if (!requireLiteral('j', file, imp)) continue
      if (imp.specifier === 'child_process' || imp.specifier === 'node:child_process') {
        if (imp.typeOnly) continue
        const ok = inAny(file, allowed.j.childProcess)
        found('j', file, imp.line, imp.specifier, ok)
        if (!ok) fail('j', file, imp.line, `\`${imp.specifier}\` import`)
      }
      if (imp.specifier === 'better-sqlite3' && !imp.typeOnly) {
        const ok = inAny(file, allowed.k.files)
        found('k', file, imp.line, imp.specifier, ok)
        if (!ok) fail('k', file, imp.line, '`better-sqlite3` 값 import')
      }
      if (allowed.f.threads.includes(imp.specifier)) {
        found('f', file, imp.line, imp.specifier, false)
        fail('f', file, imp.line, `\`${imp.specifier}\` import — main 에서 스레드를 쓰지 않는다`)
      }
    }
  }

  // ── (l) 영속 파일 — `electron-store` 는 등록 파일이 `cwd` 를 줘서만 연다 ────────────
  for (const file of mainFiles) {
    const { sf, imports } = load(file)
    const storeImports = imports.filter(
      (imp) => imp.specifier === allowed.l.module && !imp.typeOnly
    )
    if (storeImports.length === 0) continue
    const registeredFile = inAny(file, allowed.l.files)
    for (const imp of storeImports) {
      found('l', file, imp.line, allowed.l.module, registeredFile)
      if (!registeredFile) fail('l', file, imp.line, `\`${allowed.l.module}\` 값 import`)
    }
    if (!registeredFile) continue
    const local = storeClassName(sf, allowed.l.module)
    if (local === null) {
      fail(
        'l',
        file,
        storeImports[0].line,
        'default import 가 아닌 형태 — 생성 자리를 판정할 수 없다'
      )
      continue
    }
    let opened = 0
    visit(sf, (node) => {
      if (!ts.isIdentifier(node) || node.text !== local) return
      const parent = node.parent
      if (ts.isImportClause(parent) || ts.isTypeReferenceNode(parent)) return
      const line = lineOf(sf, node)
      if (!ts.isNewExpression(parent) || parent.expression !== node) {
        fail('l', file, line, `\`${local}\` 를 생성 밖에서 값으로 쓴다 — 판정할 수 없다`)
        return
      }
      opened += 1
      const arg = parent.arguments?.[0]
      const hasCwd =
        arg !== undefined &&
        ts.isObjectLiteralExpression(arg) &&
        arg.properties.some(
          (prop) =>
            (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
            (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)) &&
            prop.name.text === 'cwd'
        )
      found('l', file, line, `new ${local}`, hasCwd)
      if (!hasCwd) {
        fail('l', file, line, `\`new ${local}(\` 의 인자가 \`cwd\` 를 가진 객체 리터럴이 아니다`)
      }
    })
    if (opened === 0)
      fail('l', file, 0, `\`${allowed.l.module}\` 를 import 하지만 생성 자리가 없다`)
  }

  // ── (e) 셸 그래프 · (f) 호스트 그래프 ───────────────────────────────────────────────
  const reach = (rule, entry) => {
    const seen = new Map() // file → 그 파일에 닿은 경로의 직전 파일
    const packages = []
    if (!existsSync(join(root, entry))) {
      fail(rule, entry, 0, '진입점 파일이 없다')
      return { seen, packages }
    }
    const queue = [entry]
    seen.set(entry, null)
    while (queue.length > 0) {
      const file = queue.shift()
      for (const imp of load(file).imports) {
        if (imp.typeOnly) continue
        if (!requireLiteral(rule, file, imp)) continue
        const target = resolveSpecifier(root, file, imp.specifier)
        if (target.unresolved) {
          fail(rule, file, imp.line, `\`${imp.specifier}\` 를 파일로 풀 수 없다`)
        } else if (target.package) {
          packages.push({ file, line: imp.line, name: target.package })
        } else if (target.file && !seen.has(target.file)) {
          seen.set(target.file, file)
          queue.push(target.file)
        }
      }
    }
    return { seen, packages }
  }
  const trail = (seen, file) => {
    const path = []
    for (let at = file; at; at = seen.get(at)) path.unshift(at)
    return path.join(' → ')
  }

  const shell = reach('e', allowed.e.entry)
  for (const file of shell.seen.keys()) {
    const hit = inAny(file, allowed.e.dirs)
    if (!hit) continue
    found('e', file, 0, trail(shell.seen, file), false)
    fail('e', file, 0, `셸에서 닿는다: ${trail(shell.seen, file)}`)
  }
  for (const pkg of shell.packages) {
    if (!allowed.e.packages.some((name) => packageMatches(pkg.name, name))) continue
    found('e', pkg.file, pkg.line, pkg.name, false)
    fail(
      'e',
      pkg.file,
      pkg.line,
      `셸에서 \`${pkg.name}\` 에 닿는다: ${trail(shell.seen, pkg.file)}`
    )
  }

  // (e2)(e3) 두 호스트 그래프 — 진입점이 아직 없으면 닿는 파일이 없다.
  for (const [label, graph] of [
    ['e2 에이전트 호스트', allowed.e.agent],
    ['e3 데이터 호스트', allowed.e.data]
  ]) {
    if (!graph) continue
    const host = reach('e', graph.entry)
    for (const file of host.seen.keys()) {
      const banned =
        inAny(file, graph.dirs ?? []) && !inAny(file, graph.exceptDirs ?? [])
          ? true
          : (graph.files ?? []).includes(file)
      if (!banned) continue
      found('e', file, 0, `${label}: ${trail(host.seen, file)}`, false)
      fail('e', file, 0, `(${label})에서 닿는다: ${trail(host.seen, file)}`)
    }
    for (const pkg of host.packages) {
      if (!graph.packages.some((name) => packageMatches(pkg.name, name))) continue
      found('e', pkg.file, pkg.line, `${label}: ${pkg.name}`, false)
      fail(
        'e',
        pkg.file,
        pkg.line,
        `(${label})에서 \`${pkg.name}\` 에 닿는다: ${trail(host.seen, pkg.file)}`
      )
    }
  }

  for (const entry of allowed.f.entries) {
    const host = reach('f', entry)
    for (const pkg of host.packages) {
      if (!packageMatches(pkg.name, 'electron')) continue
      const ok = inAny(pkg.file, allowed.f.electronFiles)
      found('f', pkg.file, pkg.line, `electron ← ${entry}`, ok)
      if (!ok) {
        fail(
          'f',
          pkg.file,
          pkg.line,
          `호스트에서 닿는 \`electron\` 값 import: ${trail(host.seen, pkg.file)}`
        )
      }
    }
  }

  // ── 문서 대조 — 가드의 규칙 id 와 경로 표의 규칙 id 가 같아야 한다 ───────────────────
  const documented = documentedRuleIds(docPath)
  if (documented === null) {
    fail('doc', toPosix(relative(root, docPath)), 0, '경로 표 문서가 없거나 표를 찾지 못했다')
  } else {
    for (const id of RULE_IDS) {
      if (!documented.has(id)) fail('doc', DOC, 0, `규칙 (${id}) 가 경로 표에 없다`)
    }
    for (const id of documented) {
      if (!RULE_IDS.includes(id)) fail('doc', DOC, 0, `경로 표의 규칙 (${id}) 가 가드에 없다`)
    }
  }

  return { violations, findings, syncCounts }
}

/** `import X from '<module>'` 의 로컬 이름. default import 가 없으면 `null`. */
function storeClassName(sf, module) {
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === module &&
      statement.importClause?.name &&
      !statement.importClause.isTypeOnly
    ) {
      return statement.importClause.name.text
    }
  }
  return null
}

/** `x.webContents.send(` · `wc.send(` · `getAllWebContents` · `.postMessage(` 이면 그 이름. */
function windowNotify(sf, node) {
  if (ts.isIdentifier(node) && node.text === 'getAllWebContents') return 'getAllWebContents'
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null
  const method = node.expression.name.text
  if (method === 'postMessage') return 'postMessage'
  if (method !== 'send') return null
  const target = node.expression.expression
  const name = ts.isIdentifier(target)
    ? target.text
    : ts.isPropertyAccessExpression(target)
      ? target.name.text
      : null
  return name === 'wc' || name === 'webContents' ? `${name}.send` : null
}

function isWindowOo(node) {
  const isWindow = (expr) =>
    ts.isIdentifier(expr) && (expr.text === 'window' || expr.text === 'globalThis')
  if (ts.isPropertyAccessExpression(node))
    return isWindow(node.expression) && node.name.text === 'oo'
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression
    return isWindow(node.expression) && ts.isStringLiteralLike(arg) && arg.text === 'oo'
  }
  return false
}

/** 경로 표의 "직접 하면 걸리는 규칙" 칸에서 규칙 id 를 모은다. 표가 없으면 `null`. */
export function documentedRuleIds(docPath) {
  if (!existsSync(docPath)) return null
  const lines = readFileSync(docPath, 'utf8').split('\n')
  const header = lines.findIndex((line) => line.startsWith('|') && line.includes('걸리는 규칙'))
  if (header < 0) return null
  const column = lines[header].split('|').findIndex((cell) => cell.includes('걸리는 규칙'))
  const ids = new Set()
  for (let i = header + 2; i < lines.length && lines[i].startsWith('|'); i += 1) {
    const cell = lines[i].split('|')[column] ?? ''
    for (const match of cell.matchAll(/\(([a-z])\)/g)) ids.add(match[1])
  }
  return ids
}

export function formatViolation(violation) {
  const where = violation.line > 0 ? `${violation.file}:${violation.line}` : violation.file
  if (violation.rule === 'doc') return `[doc] ${where} — ${violation.detail}`
  const rule = RULES[violation.rule]
  return (
    `[(${violation.rule}) ${rule.title}] ${where} — ${violation.detail}\n` +
    `    요청하는 곳: ${rule.ask} · 경로: ${rule.route} · 문서: ${DOC}`
  )
}

/** CLI 본체 — 종료 코드와 출력 줄을 돌려준다(테스트가 프로세스 없이 부른다). */
export function run(argv = [], options = {}) {
  const result = check(options)
  const lines = []
  if (argv.includes('--list')) {
    for (const id of RULE_IDS) {
      lines.push(`(${id}) ${RULES[id].title} — ${result.findings[id].length}`)
      if (id === 'a') {
        for (const [file, count] of [...result.syncCounts].sort())
          lines.push(`    ${file} ${count}`)
        continue
      }
      for (const item of result.findings[id]) {
        const where = item.line > 0 ? `${item.file}:${item.line}` : item.file
        lines.push(`    ${item.ok ? 'ok  ' : 'FAIL'} ${where} ${item.detail}`)
      }
    }
  }
  if (result.violations.length === 0) {
    lines.push('check-ui-thread: OK')
    return { exitCode: 0, lines, result }
  }
  for (const violation of result.violations) lines.push(formatViolation(violation))
  lines.push(`check-ui-thread: ${result.violations.length}건 위반`)
  return { exitCode: 1, lines, result }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exitCode, lines } = run(process.argv.slice(2))
  for (const line of lines) (exitCode === 0 ? console.log : console.error)(line)
  process.exit(exitCode)
}
