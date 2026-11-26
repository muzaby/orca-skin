// WU-0. Run against the baseline application sources, with an Electron-ABI SQLite binding.
import { appGit, parseMeasureArgs, provenance, stampProvenance } from './stage-d/measurement.mjs'
import { baselineHostSource } from './stage-e/baseline-source.mjs'
import { stageEVerdict } from './stage-e/verdict.mjs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import {
  resolveElectron,
  runElectron,
  serveProbe,
  selectionExitCode
} from './check-transcript-selection.mjs'

const root = resolve(import.meta.dirname, '..')
const baseline = '7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6'
async function measure() {
  const args = process.argv.slice(2)
  const size = args[args.indexOf('--old-db') + 1]
  if (!args.includes('--old-db') || !['small', 'long'].includes(size))
    throw Error('Usage: node scripts/measure-stage-e.mjs [--baseline] --old-db small|long')
  const options = parseMeasureArgs(args, { fixedBaseline: baseline })
  const isBaseline = Boolean(options.baseline)
  const stamp = provenance(options)
  const hostSource = isBaseline ? baselineHostSource(appGit) : undefined
  let electron
  try {
    electron = resolveElectron()
  } catch (error) {
    return stampProvenance({ env: false, verdict: false, error: String(error) }, stamp)
  }
  const cache = join(root, 'node_modules', '.cache')
  await mkdir(cache, { recursive: true })
  const scratch = await mkdtemp(join(cache, 'stage-e-'))
  let probe
  try {
    const bundle = join(scratch, 'host.cjs')
    await build({
      ...(isBaseline
        ? {
            stdin: {
              // The pre-paging host must also build in the historical checkout, where
              // the projection service and its migration do not exist.
              contents: hostSource,
              loader: 'ts',
              resolveDir: join(root, 'scripts/stage-e')
            }
          }
        : { entryPoints: [join(root, 'scripts/stage-e/host.ts')] }),
      bundle: true,
      platform: 'node',
      outfile: bundle,
      external: ['better-sqlite3', 'electron']
    })
    probe = await serveProbe('stage-e')
    const result = await runElectron(
      electron,
      probe.origin,
      'stage-e',
      [JSON.stringify({ bundle, size, root, isBaseline })],
      1
    )
    return stampProvenance(
      {
        env: true,
        phase: isBaseline ? 'baseline' : 'projection',
        baseline,
        oldDb: size,
        ...result,
        ...stageEVerdict(result, { isBaseline, size, environment: stamp.environment })
      },
      stamp
    )
  } finally {
    await probe?.close()
    await rm(scratch, { recursive: true, force: true })
  }
}

try {
  const result = await measure()
  console.log(JSON.stringify(result))
  process.exitCode = selectionExitCode(result)
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
