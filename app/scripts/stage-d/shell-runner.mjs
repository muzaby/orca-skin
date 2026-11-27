import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { build } from 'esbuild'
import ts from 'typescript'
import { distribution } from './measurement.mjs'

const launch = promisify(execFile)

function listener(source, statements, target, name) {
  return statements.find((statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression))
      return false
    const [event] = statement.expression.arguments
    return (
      statement.expression.expression.getText(source) === target &&
      event &&
      ts.isStringLiteral(event) &&
      event.text === name
    )
  })
}

export async function runShellMeasurements(electron, baseline, { sha }) {
  const root = resolve(import.meta.dirname, '../..')
  const index = await readFile(join(root, 'src/main/index.ts'), 'utf8')
  const source = ts.createSourceFile('index.ts', index, ts.ScriptTarget.Latest, true)
  const declarations = source.statements.filter(ts.isFunctionDeclaration)
  const protocol = declarations.find((node) => node.name?.text === 'registerAppProtocol')
  const window = declarations.find((node) => node.name?.text === 'createWindow')
  const bounds = listener(source, window?.body?.statements ?? [], 'mainWindow.on', 'close')
  const fatal = listener(source, source.statements, 'process.on', 'uncaughtException')
  const quit = listener(source, source.statements, 'app.on', 'will-quit')
  if (!protocol || !bounds || !fatal || !quit)
    throw Error('Shell entry no longer matches the production fixture')
  const dir = await mkdtemp(join(tmpdir(), 'oo-stage-d-shell-build-'))
  try {
    const entry = join(root, 'scripts/stage-d-shell/probe.ts')
    const contents = await readFile(entry, 'utf8')
    const bundle = join(dir, 'main.mjs')
    await build({
      stdin: {
        contents: contents
          .replace('/* PRODUCTION_PROTOCOL */', protocol.getText(source))
          .replace('/* PRODUCTION_BOUNDS */', bounds.getText(source))
          .replace('/* PRODUCTION_FATAL */', fatal.getText(source))
          .replace('/* PRODUCTION_QUIT */', quit.getText(source)),
        loader: 'ts',
        resolveDir: join(root, 'scripts/stage-d-shell'),
        sourcefile: entry
      },
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'esm',
      external: ['electron'],
      banner: {
        js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'
      }
    })
    const args = process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []
    const { stdout } = await launch(electron, [...args, bundle], {
      timeout: 60_000,
      maxBuffer: 512_000
    })
    const line = stdout.split('\n').find((entry) => entry.startsWith('OO_RESULT '))
    if (!line) throw Error('Electron shell did not report its results')
    const result = JSON.parse(line.slice('OO_RESULT '.length))
    const timing = Object.fromEntries(
      Object.entries(result.assets).map(([id, samples]) => [
        id,
        {
          main: distribution(samples.map(({ mainMs }) => mainMs)),
          response: distribution(samples.map(({ responseMs }) => responseMs))
        }
      ])
    )
    return {
      ...result,
      sha,
      baseline,
      env: true,
      verdict: baseline || result.state.corruption.error === undefined,
      timing,
      logTiming: distribution(result.logs.flushMs)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
