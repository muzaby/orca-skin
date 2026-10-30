// 0290 미사용 export 스캐너 — module-level export 마다 production·test·fixture 소비자 수와
// 파일 내부 참조 수를 센다. TypeScript checker 로 import 별칭·re-export·namespace 접근을 원본
// 선언까지 따라간다. 동적 import / `typeof import()` 대상 모듈은 ns-escaped 로 표시하고 세지 않는다.
//
// usage (repo root):
//   node docs/handoff/0290-simplify-0254-0289/scan/dead-exports.cjs [--app app] [--scope list.txt] --out out.tsv
//   --scope 생략 = app/src 의 비테스트 .ts/.tsx 전부. list 는 repo root 기준 경로 한 줄씩.
const path = require('path')
const fs = require('fs')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]])
    return pairs
  }, [])
)
const ROOT = path.resolve(__dirname, '../../../..')
const APP = path.resolve(ROOT, args.app ?? 'app')
const ts = require(path.join(APP, 'node_modules/typescript'))
if (!args.out) throw new Error('--out is required')

const isTest = (f) =>
  /\.(test|spec)\.(ts|tsx)$/.test(f) || /\.test(fixture|lib)\.tsx?$/.test(f) || f.includes('/__tests__/')
const kindOf = (f) => (isTest(f) ? 'test' : f.startsWith(path.join(APP, 'scripts') + path.sep) ? 'fixture' : 'prod')

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !isTest(file)) out.push(file)
  }
  return out
}
const scope = new Set(
  args.scope
    ? fs
        .readFileSync(path.resolve(ROOT, args.scope), 'utf8')
        .split('\n')
        .filter((l) => /\.(ts|tsx)$/.test(l) && !/\.d\.ts$/.test(l))
        .map((l) => path.join(ROOT, l.trim()))
    : walk(path.join(APP, 'src'))
)

function loadProgram(tsconfig) {
  const cfg = ts.readConfigFile(tsconfig, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(tsconfig))
  const options = { ...parsed.options, noEmit: true, composite: false, incremental: false }
  return ts.createProgram({ rootNames: parsed.fileNames, options })
}

const empty = () => ({ prod: new Set(), test: new Set(), fixture: new Set() })
const uses = new Map()
const nsEscaped = new Set()
const local = new Map()
const exportsByFile = new Map()
const bump = (key, kind, importer) => {
  if (!uses.has(key)) uses.set(key, empty())
  uses.get(key)[kind].add(importer)
}
const fileOf = (sym) => sym?.declarations?.[0]?.getSourceFile().fileName
function target(checker, sym) {
  if (!(sym.flags & ts.SymbolFlags.Alias)) return sym
  try {
    return checker.getAliasedSymbol(sym)
  } catch {
    return undefined
  }
}
const keyOf = (checker, sym) => {
  const t = sym && target(checker, sym)
  const file = fileOf(t)
  return file ? `${file}#${t.escapedName}` : undefined
}

function scan(program) {
  const checker = program.getTypeChecker()
  for (const sf of program.getSourceFiles()) {
    const f = sf.fileName
    if (f.includes('/node_modules/') || !f.startsWith(APP)) continue
    const importer = kindOf(f)
    const namespaces = []
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && node.importClause) {
        const mod = checker.getSymbolAtLocation(node.moduleSpecifier)
        const clause = node.importClause
        if (clause.name) {
          const k = keyOf(checker, checker.getSymbolAtLocation(clause.name))
          if (k) bump(k, importer, f)
        }
        const nb = clause.namedBindings
        if (nb && ts.isNamedImports(nb))
          for (const el of nb.elements) {
            const k = keyOf(checker, checker.getSymbolAtLocation(el.name))
            if (k) bump(k, importer, f)
          }
        else if (nb && ts.isNamespaceImport(nb) && mod)
          namespaces.push([checker.getSymbolAtLocation(nb.name), mod])
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const file = fileOf(node.arguments[0] && checker.getSymbolAtLocation(node.arguments[0]))
        if (file) nsEscaped.add(file)
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        const mod = checker.getSymbolAtLocation(node.argument.literal)
        const first = node.qualifier && (ts.isIdentifier(node.qualifier) ? node.qualifier : node.qualifier.left)
        if (mod && first && ts.isIdentifier(first)) {
          const exp = checker.getExportsOfModule(mod).find((e) => e.escapedName === first.text)
          const k = exp && keyOf(checker, exp)
          if (k) bump(k, importer, f)
        } else if (fileOf(mod)) nsEscaped.add(fileOf(mod))
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    if (namespaces.length) {
      const walkNs = (node) => {
        if (ts.isIdentifier(node) && !ts.isNamespaceImport(node.parent)) {
          const hit = namespaces.find(([ns]) => ns === checker.getSymbolAtLocation(node))
          if (hit) {
            const p = node.parent
            const name = ts.isPropertyAccessExpression(p) && p.expression === node ? p.name.text : ts.isQualifiedName(p) && p.left === node ? p.right.text : undefined
            const exp = name && checker.getExportsOfModule(hit[1]).find((e) => e.escapedName === name)
            const k = exp && keyOf(checker, exp)
            if (k) bump(k, importer, f)
            else if (!name && fileOf(hit[1])) nsEscaped.add(fileOf(hit[1]))
          }
        }
        ts.forEachChild(node, walkNs)
      }
      walkNs(sf)
    }
  }
  for (const sf of program.getSourceFiles()) {
    const f = sf.fileName
    if (!scope.has(f)) continue
    const mod = checker.getSymbolAtLocation(sf)
    if (!mod) continue
    const list = []
    for (const e of checker.getExportsOfModule(mod)) {
      const t = target(checker, e)
      const decl = t?.declarations?.[0]
      if (!decl) continue
      const origin = decl.getSourceFile().fileName
      const flags = t.flags
      const kind =
        flags & ts.SymbolFlags.Function ? 'function'
        : flags & ts.SymbolFlags.Class ? 'class'
        : flags & ts.SymbolFlags.Interface ? 'interface'
        : flags & ts.SymbolFlags.TypeAlias ? 'type'
        : flags & ts.SymbolFlags.Enum ? 'enum'
        : flags & ts.SymbolFlags.Variable ? 'const'
        : 'other'
      const line = decl.getSourceFile().getLineAndCharacterOfPosition(decl.getStart()).line + 1
      list.push({ name: String(e.escapedName), kind, line, origin, key: `${origin}#${t.escapedName}` })
      if (origin !== f) continue
      let n = 0
      const names = new Set((t.declarations || []).map((d) => d.name).filter(Boolean))
      const walkLocal = (node) => {
        if (ts.isIdentifier(node) && !names.has(node) && !ts.isExportSpecifier(node.parent)) {
          const s = checker.getSymbolAtLocation(node)
          if (s && (s === t || target(checker, s) === t)) n++
        }
        ts.forEachChild(node, walkLocal)
      }
      walkLocal(sf)
      const lk = `${f}#${t.escapedName}`
      local.set(lk, Math.max(local.get(lk) ?? 0, n))
    }
    exportsByFile.set(f, list)
  }
}

for (const config of ['tsconfig.test.json', 'tsconfig.web.json']) scan(loadProgram(path.join(APP, config)))

const rows = ['file\tname\tkind\town\tline\tprodUses\ttestUses\tfixtureUses\tlocalRefs\tflags\tcategory']
for (const [f, list] of exportsByFile)
  for (const e of list) {
    const u = uses.get(e.key) ?? empty()
    const ext = (s) => [...s].filter((x) => x !== e.origin && x !== f).length
    const [prod, test, fixture] = [ext(u.prod), ext(u.test), ext(u.fixture)]
    const refs = local.get(`${f}#${e.name}`) ?? 0
    const escaped = nsEscaped.has(f) || nsEscaped.has(e.origin)
    const own = e.origin === f
    const category =
      !own || escaped || prod > 0 || fixture > 0 ? 'used'
      : test > 0 ? (refs > 0 ? 'test+local' : 'test-only')
      : refs > 0 ? 'local-only' : 'dead'
    rows.push([path.relative(ROOT, f), e.name, e.kind, own ? 'own' : 'reexport', e.line, prod, test, fixture, refs, escaped ? 'ns-escaped' : '', category].join('\t'))
  }
fs.writeFileSync(path.resolve(ROOT, args.out), rows.join('\n') + '\n')
const count = (c) => rows.filter((r) => r.endsWith('\t' + c)).length
process.stdout.write(`exports=${rows.length - 1} dead=${count('dead')} test-only=${count('test-only')} local-only=${count('local-only')}\n`)
