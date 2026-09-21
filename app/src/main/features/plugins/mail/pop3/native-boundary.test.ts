import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'
import { sourceFiles, toPosix } from '../../../../infra/source-scan'

const MAIN_ROOT = join(__dirname, '..', '..', '..', '..')
const ALLOWED = 'infra/net/pop3-socket.ts'
const NATIVE_MODULES = new Set(['net', 'tls', 'node:net', 'node:tls'])
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function nativeOffenders(root: string): string[] {
  return sourceFiles(root)
    .filter((file) => {
      if (toPosix(relative(root, file)) === ALLOWED) return false
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
      let found = false
      const native = (node: ts.Node | undefined): boolean =>
        !!node && ts.isStringLiteralLike(node) && NATIVE_MODULES.has(node.text)
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && native(node.moduleSpecifier)) {
          const clause = node.importClause
          const bindings = clause?.namedBindings
          const typeOnly =
            clause?.isTypeOnly ||
            (!clause?.name &&
              bindings &&
              ts.isNamedImports(bindings) &&
              bindings.elements.length > 0 &&
              bindings.elements.every((item) => item.isTypeOnly))
          if (!typeOnly) found = true
        } else if (ts.isExportDeclaration(node) && native(node.moduleSpecifier)) {
          const clause = node.exportClause
          const typeOnly =
            node.isTypeOnly ||
            (clause &&
              ts.isNamedExports(clause) &&
              clause.elements.length > 0 &&
              clause.elements.every((item) => item.isTypeOnly))
          if (!typeOnly) found = true
        } else if (
          ts.isImportEqualsDeclaration(node) &&
          !node.isTypeOnly &&
          ts.isExternalModuleReference(node.moduleReference) &&
          native(node.moduleReference.expression)
        ) {
          found = true
        } else if (
          ts.isCallExpression(node) &&
          native(node.arguments[0]) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
          found = true
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
      return found
    })
    .map((file) => toPosix(relative(root, file)))
}

describe('POP3 native boundary', () => {
  it('node:net/node:tls imports are isolated to infra/net/pop3-socket.ts', () => {
    const offenders = nativeOffenders(MAIN_ROOT)
    expect(offenders).toEqual([])
  })

  it('detects a native runtime import outside the exact boundary path', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pop3-boundary-'))
    roots.push(root)
    mkdirSync(join(root, 'feature'))
    writeFileSync(join(root, 'feature', 'freshness.ts'), "import { connect } from 'node:net'")
    writeFileSync(join(root, 'feature', 'pop3-socket.ts'), "import { connect } from 'node:tls'")
    expect(nativeOffenders(root).sort()).toEqual(['feature/freshness.ts', 'feature/pop3-socket.ts'])
  })

  it.each([
    "import net from 'net'",
    "import * as tls from 'tls'",
    "import 'node:net'",
    "export { connect } from 'node:tls'",
    "export * from 'net'",
    "const net = require('node:net')",
    "const tls = import('node:tls')",
    "import net = require('net')",
    "import { type Socket, connect } from 'net'"
  ])('rejects runtime module loading: %s', (source) => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pop3-boundary-'))
    roots.push(root)
    writeFileSync(join(root, 'other.ts'), source)
    expect(nativeOffenders(root)).toEqual(['other.ts'])
  })

  it('allows type-only references and ignores text, comments and tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-pop3-boundary-'))
    roots.push(root)
    writeFileSync(
      join(root, 'types.ts'),
      `import type { Socket } from 'node:net'
      import { type TlsOptions } from 'node:tls'
      export type { Socket } from 'net'
      export { type TlsOptions } from 'tls'
      // import { connect } from 'node:net'
      const example = "import { connect } from 'node:tls'"`
    )
    writeFileSync(join(root, 'allowed.test.ts'), "import { connect } from 'node:net'")
    mkdirSync(join(root, 'infra/net'), { recursive: true })
    writeFileSync(join(root, ALLOWED), "import { connect } from 'node:net'")
    expect(nativeOffenders(root)).toEqual([])
  })

  it('the allowed boundary contains both native transports', () => {
    const source = readFileSync(join(MAIN_ROOT, 'infra/net/pop3-socket.ts'), 'utf8')
    expect(source).toMatch(/node:net/)
    expect(source).toMatch(/node:tls/)
  })

  it('the protocol allowlist never admits DELE', () => {
    const source = readFileSync(join(MAIN_ROOT, 'infra/net/pop3-session.ts'), 'utf8')
    const declaration = source.match(/const ALLOWED_COMMANDS = new Set\(\[([^\]]+)\]\)/)?.[1]
    expect(declaration).toBeDefined()
    expect(declaration).not.toMatch(/['"]DELE['"]/)
  })
})
