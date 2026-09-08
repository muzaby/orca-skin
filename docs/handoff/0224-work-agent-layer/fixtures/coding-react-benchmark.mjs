// Codex 작성. 앱 production 파일을 바꾸지 않는 AC14 실제 React 비교 fixture.
// 준비: node docs/handoff/0224-work-agent-layer/fixtures/coding-react-benchmark.mjs
// 실행은 준비 결과에 출력한 Electron 명령으로, 다른 시험 종료 후 수행한다.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const fixture = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(fixture, '../../../..')
const app = path.join(repo, 'app')
const require = createRequire(path.join(app, 'package.json'))
const { build } = require('esbuild')
const cache = fs.mkdtempSync(path.join(app, 'node_modules/.cache/orca/coding-react-'))
const baseline = '04953cf7'
const archive = path.join(cache, 'baseline.tar')
execFileSync('git', ['archive', baseline, 'app/src', '-o', archive], { cwd: repo, windowsHide: true })
execFileSync('tar', ['-xf', archive, '-C', cache], { windowsHide: true })
const manifests = []
for (const [label, source] of [['baseline', path.join(cache, 'app/src')], ['current', path.join(app, 'src')]]) {
  const instrumented = []
  const hashes = {}
  await build({
    entryPoints: [path.join(fixture, 'coding-react-browser.tsx')],
    outfile: path.join(cache, `${label}.js`), bundle: true, format: 'iife', platform: 'browser',
    jsx: 'automatic', minify: true, metafile: false, nodePaths: [path.join(app, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: {
      '@benchmark-source': source,
      'react-dom/client': require.resolve('react-dom/profiling')
    },
    plugins: [{ name: 'observe-real-render-functions', setup(builder) {
      builder.onLoad({ filter: /[\\/](Exchange|AssistantTurn|AssistantMessage)\.tsx$/ }, args => {
        const name = path.basename(args.path, '.tsx')
        let contents = fs.readFileSync(args.path, 'utf8')
        hashes[path.relative(source, args.path).replaceAll('\\', '/')] = createHash('sha256').update(contents).digest('hex')
        const pattern = new RegExp(`function ${name}\\([\\s\\S]*?\\): React\\.JSX\\.Element \\{`)
        if (!pattern.test(contents)) throw new Error(`Actual named render function missing: ${args.path}`)
        contents = contents.replace(pattern, match => `${match}\nwindow.__renderCounts.${name}++;`)
        instrumented.push(name)
        return { contents, loader: 'tsx', resolveDir: path.dirname(args.path) }
      })
    }}]
  })
  if (new Set(instrumented).size !== 3) throw new Error(`Incomplete component instrumentation: ${label}`)
  fs.writeFileSync(path.join(cache, `${label}.html`), `<!doctype html><meta charset="utf-8"><title>Orca synthetic benchmark</title><style>body{margin:0;font:14px Arial;width:1000px}#root{width:900px}button{font:inherit}svg{width:18px;height:18px}</style><div id="root"></div><script src="${label}.js"></script>`)
  manifests.push({ label, source, instrumented, hashes })
}
fs.writeFileSync(path.join(cache, 'manifest.json'), JSON.stringify({
  baseline, current: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  fixtureSha256: createHash('sha256').update(fs.readFileSync(path.join(fixture, 'coding-react-browser.tsx'))).digest('hex'),
  react: require('react/package.json').version, electron: require('electron/package.json').version,
  manifests
}, null, 2))
console.log(JSON.stringify({ cache, run: [path.join(app, 'node_modules/electron/dist/electron.exe'), path.join(fixture, 'coding-react-runner.cjs'), cache] }, null, 2))
