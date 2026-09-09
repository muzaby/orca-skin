// Codex 작성. 기존 Coding benchmark와 독립된 Work DOM 수명 fixture 준비.
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const fixture = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(fixture, '../../../..')
const app = path.join(repo, 'app')
const require = createRequire(path.join(app, 'package.json'))
const cache = fs.mkdtempSync(path.join(app, 'node_modules/.cache/orca/work-react-lifetime-'))
const source = path.join(app, 'src')
await require('esbuild').build({ entryPoints: [path.join(fixture, 'work-react-lifetime-browser.tsx')], outfile: path.join(cache, 'work.js'), bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', minify: true, nodePaths: [path.join(app, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, alias: { '@work-source': source } })
const assets = path.join(app, 'out/renderer/assets')
const css = fs.readdirSync(assets).filter(name => name.endsWith('.css'))
if (css.length !== 1) throw new Error('Expected one current production stylesheet')
fs.writeFileSync(path.join(cache, 'work.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(assets, css[0])).href}"><style>body{margin:0}#root{width:900px}#viewport{height:480px;overflow:auto;overflow-anchor:none}#content{padding:20px}</style><div id="root"></div><script src="work.js"></script></html>`)
const productionFiles = ['renderer/src/features/chat/components/transcript/Exchange.tsx', 'renderer/src/features/chat/components/transcript/WorkActivity.tsx', 'renderer/src/features/chat/components/transcript/AssistantTurn.tsx', 'renderer/src/features/chat/hooks/useScrollAnchor.ts', 'renderer/src/features/chat/lib/workActivity.ts', 'renderer/src/features/chat/lib/workToolResults.ts']
fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({ scope: 'Actual Work Exchange/ToolCard plus actual useScrollAnchor, synthetic messages, production CSS; excludes virtualizer, IPC/SDK, whole app navigation and paint/FPS', hashes: Object.fromEntries(productionFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(source, file))).digest('hex')])), react: require('react/package.json').version, electron: require('electron/package.json').version }, null, 2))
console.log(JSON.stringify({ cache, run: [path.join(app, 'node_modules/electron/dist/electron.exe'), path.join(fixture, 'work-react-lifetime-runner.cjs'), cache] }, null, 2))
