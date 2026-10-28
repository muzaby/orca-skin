import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import ts from 'typescript'

it('wires the live MCP source into bootstrap consumers and broadcasts only its revision', () => {
  const file = ts.createSourceFile(
    'bootstrap.ts',
    readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const calls: ts.CallExpression[] = [],
    constructors: ts.NewExpression[] = [],
    methods: ts.MethodDeclaration[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node)
    if (ts.isNewExpression(node)) constructors.push(node)
    if (ts.isMethodDeclaration(node)) methods.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  const text = (node: ts.Node): string => node.getText(file).replace(/\s+/g, '')
  const call = (name: string): ts.CallExpression => {
    const found = calls.find((entry) => text(entry.expression) === name)
    expect(found, name).toBeDefined()
    return found!
  }
  expect(call('createManagedMcp').arguments.map(text)).toEqual(['this.mcp', 'plugins'])
  expect(call('createComposerPreparation').arguments.map(text)).toEqual(['ctx'])
  const registry = call('createAdapterRegistry').arguments[0]
  expect(ts.isObjectLiteralExpression(registry)).toBe(true)
  const managed = (registry as ts.ObjectLiteralExpression).properties.find(
    (property) => property.name && text(property.name) === 'managedMcp'
  ) as ts.PropertyAssignment
  expect(managed).toBeDefined()
  const managedCalls: string[] = []
  const readManaged = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) managedCalls.push(text(node))
    ts.forEachChild(node, readManaged)
  }
  readManaged(managed)
  expect(managedCalls).toContain('this.managedMcp?.source.snapshot()')
  expect(managedCalls).toContain('this.managedMcp.mcpBridge.acquire(snapshot)')
  expect(
    constructors
      .find((node) => text(node.expression) === 'ExtensionBuilder')
      ?.arguments?.at(-1)
      ?.getText(file)
  ).toBe('this.managedMcp.source')
  const deploy = methods.find((method) => text(method.name) === 'deployExtensions')!
  expect(text(deploy.body!.statements[0])).toBe('this.managedMcp?.source.refresh()')
  const change = call('createRuntimeModelAuthChangeHandler')
    .arguments[0] as ts.ObjectLiteralExpression
  const sync = change.properties.find(
    (property) => property.name && text(property.name) === 'syncPlugins'
  ) as ts.PropertyAssignment
  expect(text((sync.initializer as ts.ArrowFunction).body)).toContain(
    'this.managedMcp?.source.refresh()'
  )
  const shutdown = methods.find((method) => text(method.name) === 'shutdown')!
  expect(text(shutdown.body!)).toContain('this.managedMcp?.mcpBridge.close()')
  const changed = call('this.managedMcp?.source.subscribe').arguments[0] as ts.ArrowFunction
  const changedCalls: ts.CallExpression[] = []
  const readChanged = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) changedCalls.push(node)
    ts.forEachChild(node, readChanged)
  }
  readChanged(changed.body)
  expect(changedCalls.map(text)).toContain('this.closeComposerCatalog?.invalidate()')
  expect(changedCalls.map(text)).toContain('preparedMcp.invalidate()')
  const send = changedCalls.find((node) => text(node.expression) === 'wc.send')!
  expect(send.arguments.map(text)).toEqual(['CHANNELS.managedMcpChanged', '{revision}'])
})
