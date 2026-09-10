import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'

// 현재 production React와 CSS를 격리된 fixture로 빌드한다. app/out과 기존 증거는 쓰지 않는다.
const fixture = path.dirname(fileURLToPath(import.meta.url))
let repo = fixture
while (!fs.existsSync(path.join(repo, 'app/package.json'))) {
  const parent = path.dirname(repo)
  if (parent === repo) throw Error('Repository app/package.json not found')
  repo = parent
}
const app = path.join(repo, 'app')
const require = createRequire(path.join(app, 'package.json'))
const cacheRoot = path.join(app, 'node_modules/.cache/orca')
fs.mkdirSync(cacheRoot, { recursive: true })
const cache = fs.mkdtempSync(path.join(cacheRoot, 'r7-button-native-'))
const built = await require('esbuild').build({
  absWorkingDir: repo,
  entryPoints: [path.join(fixture, 'r7-button-native-browser.tsx')],
  outfile: path.join(cache, 'fixture.js'),
  bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', minify: true,
  metafile: true, loader: { '.webp': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
  nodePaths: [path.join(app, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', '__APP_VERSION__': '"test"' },
  alias: { '@source': path.join(app, 'src') }
})
// Optional first argument: final electron-vite production CSS for artifact-level confirmation.
let stylesheet = process.argv[2] ? path.resolve(repo, process.argv[2]) : null
if (!stylesheet) {
  const { build } = await import(pathToFileURL(require.resolve('vite')).href)
  const { default: tailwindcss } = await import(pathToFileURL(require.resolve('@tailwindcss/vite')).href)
  process.chdir(app)
  await build({
    configFile: false,
    root: path.join(app, 'src/renderer'),
    base: './',
    plugins: [tailwindcss()],
    build: {
      outDir: path.join(cache, 'styles'), emptyOutDir: false,
      rollupOptions: { input: path.join(app, 'src/renderer/src/styles/app.css') }
    }
  })
  const assets = path.join(cache, 'styles/assets')
  const styles = fs.readdirSync(assets).filter(name => name.endsWith('.css'))
  if (styles.length !== 1) throw Error('Expected one compiled production stylesheet')
  stylesheet = path.join(assets, styles[0])
}
const csp = fs.readFileSync(path.join(app, 'src/renderer/index.html'), 'utf8').match(/content="(default-src[^\"]*)"/)[1]
fs.writeFileSync(path.join(cache, 'fixture.html'), `<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${pathToFileURL(stylesheet).href}"><div id="root"></div><script src="fixture.js"></script></html>`)
fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({
  files: Object.fromEntries(Object.keys(built.metafile.inputs).filter(name => name.startsWith('app/src/')).map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(repo, name))).digest('hex')])),
  stylesheet: createHash('sha256').update(fs.readFileSync(stylesheet)).digest('hex'),
  stylesheetPath: path.relative(repo, stylesheet).replaceAll('\\', '/')
}, null, 2))
console.log(JSON.stringify({ cache }))
