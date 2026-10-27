import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import ts from 'typescript'
import { createPluginBindings, type PluginDeploymentDeps } from './deployment/plugins'

vi.setConfig({ testTimeout: 60_000 })
it('matches deployment recipes and secret boundaries', () => {
  const guide = readFileSync(
    new URL('../../../../docs/guides/closed-network-extensions.md', import.meta.url),
    'utf8'
  )
  const blocks = [...guide.matchAll(/```ts\r?\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .filter((block) => block.includes('// app/deployment/plugins.ts — 서버는'))
  expect(blocks).toHaveLength(1)
  const virtual = join(
    dirname(fileURLToPath(import.meta.url)),
    'deployment',
    'document-recipe.testfixture.ts'
  )
  const canonical = (path: string): string => resolve(path).replaceAll('\\', '/').toLowerCase()
  const config = ts.readConfigFile(resolve('tsconfig.test.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
  const compile = (recipe: string): readonly ts.Diagnostic[] => {
    const content = `import {createPluginBinding, type PluginBinding, type PluginDeploymentDeps} from './plugins';
import {confluenceTools} from '../../features/plugins/confluence/tools';
const CONFLUENCE_AUTH={id:'wiki'};
${recipe}`
    const options = {
      ...parsed.options,
      noEmit: true,
      composite: false,
      incremental: false,
      tsBuildInfoFile: undefined
    }
    const host = ts.createCompilerHost(options)
    const read = host.getSourceFile.bind(host)
    const exists = host.fileExists.bind(host)
    host.fileExists = (path) => canonical(path) === canonical(virtual) || exists(path)
    host.getSourceFile = (path, languageVersion, onError, createNew) =>
      canonical(path) === canonical(virtual)
        ? ts.createSourceFile(path, content, languageVersion, true)
        : read(path, languageVersion, onError, createNew)
    const program = ts.createProgram([virtual, resolve('src/main/env.d.ts')], options, host)
    expect(program.getSourceFile(virtual)).toBeDefined()
    return ts
      .getPreEmitDiagnostics(program)
      .filter(
        (diagnostic) =>
          diagnostic.file && canonical(diagnostic.file.fileName) === canonical(virtual)
      )
  }
  expect(
    compile(blocks[0]).map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
  ).toEqual([])
  expect(
    compile(blocks[0].replace('registry: deps.registry', 'registry: 42')).map(
      (diagnostic) => diagnostic.code
    )
  ).toEqual([2322])
  const add = vi.fn(),
    remove = vi.fn()
  expect(
    createPluginBindings({ auth: {} as PluginDeploymentDeps['auth'], registry: { add, remove } })
  ).toEqual([])
  expect(add).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})
