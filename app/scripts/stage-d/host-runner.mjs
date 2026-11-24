import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { runElectron, serveProbe } from '../check-transcript-selection.mjs'
import { hostDecision, rendererDecision, summarize } from './measurement.mjs'

export async function runHostMeasurements(electron, baseline, flows = false) {
  const root = resolve(import.meta.dirname, '../..')
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  if (baseline && !sha.startsWith('c7d2adf2')) throw Error('Baseline requires source c7d2adf2')
  const changes = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all', '--', 'src'],
    {
      cwd: root,
      encoding: 'utf8'
    }
  )
  if (baseline && changes) throw Error('Baseline application sources must be clean')
  const sourceHash = createHash('sha256')
  if (changes) {
    sourceHash.update(execFileSync('git', ['diff', 'HEAD', '--binary', '--', 'src'], { cwd: root }))
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '-z', 'src'],
      {
        cwd: root,
        encoding: 'utf8'
      }
    )
    for (const file of untracked.split('\0').filter(Boolean)) {
      const content = await readFile(join(root, file))
      sourceHash.update(`\0${file}\0${content.length}\0`).update(content)
    }
  }
  const sourceDiff = changes ? sourceHash.digest('hex') : null
  const cache = join(root, 'node_modules', '.cache')
  await mkdir(cache, { recursive: true })
  const scratch = await mkdtemp(join(cache, 'stage-d-'))
  let probe
  try {
    const bundle = join(scratch, 'host.cjs')
    await build({
      entryPoints: [join(root, 'scripts/stage-d-host/host.ts')],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      external: ['better-sqlite3', 'electron'],
      plugins: [
        {
          name: 'sql-raw',
          setup(builder) {
            builder.onResolve({ filter: /\.sql\?raw$/ }, (args) => ({
              namespace: 'sql-raw',
              path: resolve(args.resolveDir, args.path.slice(0, -4))
            }))
            builder.onLoad({ filter: /.*/, namespace: 'sql-raw' }, async (args) => ({
              contents: await readFile(args.path, 'utf8'),
              loader: 'text'
            }))
          }
        }
      ]
    })
    probe = await serveProbe('stage-d-host')
    const runs = 9
    const result = await runElectron(
      electron,
      probe.origin,
      'stage-d-host',
      [JSON.stringify({ bundle, baseline, sha, flows })],
      runs
    )
    if (result.error) return { env: true, verdict: false, ...result }
    if (flows === 'usage')
      return {
        ...result,
        sourceDiff,
        env: true,
        verdict:
          result.samples?.length === runs &&
          result.samples.every(
            (sample) =>
              sample.length === 5 &&
              sample.every((row) => row.modelTokens === 21 && row.paintedBars > 0)
          )
      }
    if (flows)
      return {
        ...result,
        sourceDiff,
        env: true,
        verdict:
          result.usage?.length === 5 &&
          result.search?.length === 2 &&
          result.folders?.length === 4 &&
          result.schedule?.bytes === 65536 &&
          result.composer?.length === 3 &&
          result.composer.every(
            (row) =>
              row.sameTask &&
              row.followup &&
              row.reopened?.files === 5 &&
              row.reopened.previews === 2
          )
      }
    const measurements = result.measurements.map((entry) => ({
      ...entry,
      stats: summarize(entry.samples),
      host: hostDecision(entry.samples, result.budget),
      renderer: rendererDecision(entry.samples, result.budget)
    }))
    return {
      ...result,
      sourceDiff,
      measurements,
      env: true,
      verdict:
        measurements.length === 7 &&
        measurements.every(
          (entry) =>
            entry.samples.length === runs &&
            entry.samples.every(({ C1, C2 }) => C1 > 0 && C2 > 0) &&
            entry.host.decision !== 'unavailable'
        )
    }
  } finally {
    await probe?.close()
    await rm(scratch, { recursive: true, force: true })
  }
}
