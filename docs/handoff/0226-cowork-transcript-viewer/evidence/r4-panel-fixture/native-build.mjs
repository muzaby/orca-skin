import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { htmlSource } from './native-data.mjs'
const fixture = path.dirname(fileURLToPath(import.meta.url))
let repo = fixture
while (!fs.existsSync(path.join(repo, 'app/package.json'))) {
  const parent = path.dirname(repo)
  if (parent === repo) throw new Error('Run this fixture from the Orca repository')
  repo = parent
}
const app = path.join(repo, 'app')
const require = createRequire(path.join(app, 'package.json'))
const cacheRoot = path.join(app, 'node_modules/.cache/orca')
fs.mkdirSync(cacheRoot, { recursive: true })
const cache = fs.mkdtempSync(path.join(cacheRoot, 'shared-pane-native-'))
const mainBuild = await require('esbuild').build({
  absWorkingDir: repo, entryPoints: [path.join(app, 'src/main/features/artifacts/formats.ts')],
  outfile: path.join(cache, 'formats.cjs'), bundle: true, format: 'cjs', platform: 'node',
  packages: 'external', metafile: true
})
const { artifactPreview } = require(path.join(cache, 'formats.cjs'))
fs.writeFileSync(path.join(cache, 'fixture-data.js'), `window.nativeHtmlPreview=${JSON.stringify(artifactPreview('report.html', Buffer.from(htmlSource)))};`)
const built = await require('esbuild').build({
  absWorkingDir: repo, entryPoints: [path.join(fixture, 'native-browser.tsx')],
  outfile: path.join(cache, 'fixture.js'), bundle: true, format: 'iife', platform: 'browser',
  jsx: 'automatic', minify: true, metafile: true, nodePaths: [path.join(app, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@source': path.join(app, 'src') }
})
const assets = path.join(app, 'out/renderer/assets')
const styles = fs.readdirSync(assets).filter(name => name.endsWith('.css'))
if (styles.length !== 1) throw new Error('Expected one built stylesheet')
const css = path.join(assets, styles[0])
const cssBytes = fs.readFileSync(css)
fs.writeFileSync(path.join(cache, 'fixture.css'), cssBytes)
const csp = fs.readFileSync(path.join(app, 'src/renderer/index.html'), 'utf8').match(/content="(default-src[^\"]*)"/)[1]
fs.writeFileSync(path.join(cache, 'fixture.html'), `<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="fixture.css"><style>#root{height:100vh}</style><div id="root"></div><script src="fixture-data.js"></script><script src="fixture.js"></script></html>`)
const relativeFixture = path.relative(repo, fixture).split(path.sep).join('/')
const files = [...new Set([...Object.keys(built.metafile.inputs), ...Object.keys(mainBuild.metafile.inputs)].filter(name => name.startsWith('app/src/') || name.startsWith(relativeFixture + '/'))), ...['native-browser.tsx','native-runner.cjs','native-build.mjs','native-data.mjs'].map(name => path.relative(repo,path.join(fixture,name))), path.relative(repo, css)]
fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({ stylesheet: { source: path.relative(repo, css), cacheFile: 'fixture.css', sha256: createHash('sha256').update(cssBytes).digest('hex') }, files: Object.fromEntries(files.map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(repo, name))).digest('hex')])) }, null, 2))
console.log(JSON.stringify({ cache }))
