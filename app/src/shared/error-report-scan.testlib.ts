import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

export function sourceTree(text: string, file = 'source.ts'): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

export function collect<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T
): T[] {
  const nodes: T[] = []
  function visit(node: ts.Node): void {
    if (predicate(node)) nodes.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return nodes
}

export function catches(source: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = []
  function visit(node: ts.Node): void {
    if (ts.isCatchClause(node)) nodes.push(node)
    else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch'
    ) {
      if (node.arguments[0]) nodes.push(node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return nodes
}

export function calls(root: ts.Node, name: string): ts.CallExpression[] {
  return collect(root, ts.isCallExpression).filter(
    (node) => ts.isIdentifier(node.expression) && node.expression.text === name
  )
}

export function property(call: ts.CallExpression, name: string): string | undefined {
  const arg = call.arguments[0]
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined
  const prop = arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === name)
  return prop && ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer)
    ? prop.initializer.text
    : undefined
}

export function enclosingFunction(node: ts.Node): ts.Node {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isFunctionDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isFunctionExpression(parent)
    )
      return parent
  }
  return node.getSourceFile()
}

export function logs(root: ts.Node, event: string): ts.CallExpression[] {
  return collect(root, ts.isCallExpression).filter(
    (node) =>
      ts.isPropertyAccessExpression(node.expression) &&
      ['warn', 'error'].includes(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === event
  )
}

export function productionFiles(root: string): string[] {
  const result: string[] = []
  function walk(dir: string): void {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else if (
        /\.tsx?$/.test(rel) &&
        !/\.(?:test|testlib|testHarness)\./.test(rel) &&
        !rel.endsWith('.d.ts')
      )
        result.push(rel)
    }
  }
  walk('')
  return result
}
