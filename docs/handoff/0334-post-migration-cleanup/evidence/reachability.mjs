// Run from the checkout to inspect. For a9ce2426, use --all --before-0324.
// By default, report changed sources. Pass --all to include unchanged files whose callers moved.
// Static edges include type-only imports. Registrations and script paths still need a caller review.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { posix } from 'node:path'

const ts = createRequire(new URL('../../../../app/package.json', import.meta.url))('typescript')
const lines = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' })
    .trimEnd()
    .split('\n')
    .filter(Boolean)
const files = new Set(
  lines('ls-files', 'app/src').filter((p) => /\.[cm]?[tj]sx?$/.test(p))
)
const changed = new Set(
  lines('diff', '--name-only', 'a9ce2426', '--', 'app/src')
)
const support = (p) =>
  /\.(test|testfixture|testlib|testHarness|spec|d)\.[cm]?[tj]sx?$/.test(p)
const hostRoots = [
  'app/src/main/app/agent-host/entry.ts',
  'app/src/main/app/data-host/entry.ts'
]
const roots = [
  'app/src/main/index.ts',
  ...(process.argv.includes('--before-0324') ? [] : hostRoots),
  'app/src/preload/index.ts',
  'app/src/renderer/src/main.tsx'
]
const imports = new Map()

function resolveFile(file, specifier) {
  const spec = specifier.split('?')[0]
  let base
  if (spec.startsWith('.')) base = posix.join(posix.dirname(file), spec)
  else if (spec.startsWith('@renderer/'))
    base = 'app/src/renderer/src/' + spec.slice('@renderer/'.length)
  else return
  const names = [
    base,
    ...[
      '.ts',
      '.tsx',
      '.js',
      '.mjs',
      '/index.ts',
      '/index.tsx',
      '/index.js'
    ].map((ext) => base + ext)
  ]
  return names.find((name) => files.has(name))
}

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest
  )
  const edges = new Set()
  function walk(node) {
    let literal
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      literal = node.moduleSpecifier
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      literal = node.arguments[0]
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'URL'
    ) {
      literal = node.arguments?.[0]
    }
    if (literal && ts.isStringLiteralLike(literal)) {
      const target = resolveFile(file, literal.text)
      if (target) edges.add(target)
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  imports.set(file, edges)
}

const reachable = new Set()
function visit(file) {
  if (support(file) || reachable.has(file)) return
  if (!files.has(file)) throw new Error('Missing entry: ' + file)
  reachable.add(file)
  for (const dependency of imports.get(file)) visit(dependency)
}
roots.forEach(visit)

const includeUnchanged = process.argv.includes('--all')
for (const file of files) {
  if (support(file) || reachable.has(file)) continue
  if (!includeUnchanged && !changed.has(file)) continue
  const users = [...imports]
    .filter(([, edges]) => edges.has(file))
    .map(([caller]) => caller)
  console.log(file)
  for (const caller of users) console.log('  ' + caller)
}
console.log(
  'Worker entries reached via new URL:',
  [...reachable].filter((p) => p.endsWith('.worker.ts')).length
)
