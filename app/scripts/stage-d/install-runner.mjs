import { build } from 'esbuild'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { serveProbe, runElectron } from '../check-transcript-selection.mjs'

export async function runInstallFlow(electron) {
  const root = resolve(import.meta.dirname, '../..')
  const cache = join(root, 'node_modules', '.cache')
  await mkdir(cache, { recursive: true })
  const temp = await mkdtemp(join(cache, 'stage-d-install-'))
  let probe
  try {
    const bundle = join(temp, 'agent.mjs')
    await build({
      entryPoints: [join(root, 'scripts/stage-d/install-host.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundle,
      packages: 'external',
      define: { 'import.meta.env.DEV': 'false' },
      loader: { '.sql': 'text' }
    })
    probe = await serveProbe('stage-d')
    const result = await runElectron(electron, probe.origin, 'stage-d', ['installer=' + bundle], 1)
    return { env: true, ...result, verdict: !result.error && result.install?.length === 3 }
  } finally {
    await probe?.close()
    await rm(temp, { recursive: true, force: true })
  }
}
