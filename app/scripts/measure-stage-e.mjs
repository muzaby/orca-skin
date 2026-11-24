// WU-0. Run against the baseline application sources, with an Electron-ABI SQLite binding.
import { execFileSync } from 'node:child_process'
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
const baseline = '7db1c7ce'
async function measure() {
  const args = process.argv.slice(2)
  const size = args[args.indexOf('--old-db') + 1]
  if (!args.includes('--old-db') || !['small', 'long'].includes(size))
    throw Error('Usage: node scripts/measure-stage-e.mjs [--baseline] --old-db small|long')
  let electron
  try {
    electron = resolveElectron()
  } catch (error) {
    return { env: false, verdict: false, error: String(error) }
  }
  const isBaseline = args.includes('--baseline')
  if (isBaseline) {
    execFileSync('git', ['diff', '--quiet', baseline, '--', 'src'], { cwd: root })
    if (
      execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src'], {
        cwd: root
      }).length
    )
      throw Error('Baseline requires clean application sources')
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
              contents: execFileSync('git', ['show', '3d8e1d90:app/scripts/stage-e/host.ts'], {
                cwd: root,
                encoding: 'utf8'
              }),
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
    const messages = size === 'long' ? 100000 : 100
    const verdict =
      !result.error &&
      result.visible &&
      result.receivedMessages === (isBaseline ? messages : 2) &&
      result.clickToBodyFrameMs > 0 &&
      result.readerPayloadBytes > 0 &&
      result.replyJsonBytes > 0
    const bounded =
      isBaseline ||
      (result.prepared?.sourceBytes > 0 &&
        result.replyJsonBytes <= 256 * 1024 &&
        result.warm?.visible &&
        result.warm.receivedMessages === 2 &&
        result.warm.readerPayloadBytes === 0 &&
        !result.warm.prepared &&
        result.warm.replyJsonBytes <= 256 * 1024)
    const latencyGate =
      !isBaseline && size === 'long'
        ? { limitMs: 3729, pass: result.clickToBodyFrameMs <= 3729 }
        : undefined
    return {
      env: true,
      phase: isBaseline ? 'baseline' : 'projection',
      baseline,
      oldDb: size,
      ...result,
      latencyGate,
      verdict: verdict && bounded && (latencyGate?.pass ?? true)
    }
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
