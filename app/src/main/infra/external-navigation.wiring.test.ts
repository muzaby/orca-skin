import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'

// index.ts has process-wide startup side effects. Inspect its direct assembly edge;
// external-navigation.test.ts executes the registered popup/navigation handlers.
it('installs external navigation on the created main window and forwards the original URL to shell', () => {
  const source = ts.createSourceFile(
    'index.ts',
    readFileSync(new URL('../index.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  )
  const binding = source.statements.find(
    (node) =>
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier.getText(source) === "'./infra/external-navigation'"
  )
  expect(binding?.getText(source)).toContain('{ installExternalNavigation }')
  const createWindow = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'createWindow'
  )
  expect(createWindow?.body).toBeDefined()
  const calls = createWindow!
    .body!.statements.filter(ts.isExpressionStatement)
    .map((node) => node.expression)
    .filter(ts.isCallExpression)
  const registrations = calls.filter(
    (node) => node.expression.getText(source) === 'installExternalNavigation'
  )
  expect(registrations).toHaveLength(1)
  const registration = registrations[0]
  expect(registration.arguments).toHaveLength(2)
  expect(registration.arguments[0].getText(source)).toBe('mainWindow.webContents')
  const forward = registration.arguments[1]
  expect(ts.isArrowFunction(forward)).toBe(true)
  if (!ts.isArrowFunction(forward)) throw new Error('Missing shell forwarding callback')
  expect(forward.parameters).toHaveLength(1)
  expect(forward.body.getText(source)).toBe(
    `shell.openExternal(${forward.parameters[0].name.getText(source)})`
  )
})
