import { join } from 'node:path'
import { readFileSync } from 'node:fs'
const app = new URL('../../../../../app', import.meta.url).pathname
process.chdir(app)
const vite = await import(app + '/node_modules/vite/dist/node/index.js')
const { resolveConfig } = await import(app + '/node_modules/electron-vite/dist/index.js')
for (const [command, mode] of [['serve', 'development'], ['build', 'production']]) {
  const renderer = (await resolveConfig({}, command, mode)).config.renderer
  const config = await vite.resolveConfig(
    { ...renderer, root: renderer.root ?? join(app, 'src/renderer'), configFile: false, logLevel: 'silent' },
    command,
    mode
  )
  const importer = join(app, 'src/renderer/src/shared/compute/worker/markdownDefinitions.ts')
  const out = {}
  for (const [label, options] of [
    ['optimizer', { asSrc: false, scan: true }],
    ['source', { asSrc: true }]
  ]) {
    const resolver = config.createResolver(options)
    const id = await resolver('decode-named-character-reference', importer)
    out[label] = { id: id?.replace(app, ''), usesDocument: id ? /document\./.test(readFileSync(id.split('?')[0], 'utf8')) : null }
  }
  console.log(command, JSON.stringify(out))
}
