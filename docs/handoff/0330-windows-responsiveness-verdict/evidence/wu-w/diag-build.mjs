// 0330 H1 진단 빌드 — 소유 SHA마다 별도 worktree에 진단 diff를 적용하고 build:unpack 한다.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const repo = 'C:/workspace/github/claude/orca-skin'
const root = 'C:/orca-W/run1'
const log = join(root, 'diag-log.txt')
const shas = {
  d8684684: 'd86846844dc9ea092f394f942621b78dc3d50e02',
  '7c241d19': '7c241d191438e7aa9625a2914c38fe0a1b3d1bdd',
  '515ff58d': '515ff58d60eb5d76744cc34aaad20bc7f186d928'
}
const say = (s) => appendFileSync(log, `${new Date().toISOString()} ${s}\n`)
const sh = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env }, maxBuffer: 1 << 28 }).toString()
const replaceOnce = (file, from, to) => {
  const s = readFileSync(file, 'utf8')
  if (s.split(from).length !== 2) throw Error('anchor not unique: ' + file + ' :: ' + from.slice(0, 60))
  writeFileSync(file, s.replace(from, to))
}

for (const [k, sha] of Object.entries(shas)) {
  const wt = join(root, 'diag-' + k)
  try {
    if (!existsSync(wt)) sh(`git -C ${repo} worktree add --detach ${wt} ${sha}`)
    const app = join(wt, 'app')
    sh('git checkout -- .', wt)
    replaceOnce(join(app, 'electron.vite.config.ts'), "    build: { minify: 'esbuild' },", '    build: { minify: false },')
    replaceOnce(
      join(app, 'electron.vite.config.ts'),
      "      alias: {\n        '@renderer': resolve('src/renderer/src')\n      }",
      "      alias: [\n        { find: /^react-dom\\/client$/, replacement: 'react-dom/profiling' },\n        { find: '@renderer', replacement: resolve('src/renderer/src') }\n      ]"
    )
    replaceOnce(
      join(app, 'src/main/index.ts'),
      "      devTools: import.meta.env.DEV\n    }\n  })\n\n  // second-instance",
      "      devTools: true\n    }\n  })\n  if (process.env.OO_DIAG_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' })\n\n  // second-instance"
    )
    // W-047 — 측정 프로필: 진단 빌드만 env 로 userData 를 옮긴다(실제 %APPDATA%\orcinus-orca 불변).
    replaceOnce(
      join(app, 'src/main/index.ts'),
      "  app.setPath('userData', devUserDataDir(app.getPath('appData')))\n}\n",
      "  app.setPath('userData', devUserDataDir(app.getPath('appData')))\n}\nif (process.env.OO_MEASURE_USER_DATA) app.setPath('userData', process.env.OO_MEASURE_USER_DATA)\n"
    )
    const diff = sh('git diff', wt)
    writeFileSync(join(root, `diag-${k}.diff`), diff)
    say(`[${k}] diff sha256 ${createHash('sha256').update(diff).digest('hex')}`)
    say(`[${k}] npm ci`)
    if (!existsSync(join(app, 'node_modules'))) sh('npm ci', app)
    say(`[${k}] build:unpack`)
    writeFileSync(join(root, `diag-build-${k}.txt`), sh('npm run build:unpack', app, { VITE_OO_DIAGNOSTIC: '1' }))
    const exe = join(app, 'dist/win-unpacked/orcinus-orca.exe')
    say(`[${k}] exe sha256 ${createHash('sha256').update(readFileSync(exe)).digest('hex')} ${exe}`)
    say(`[${k}] OK`)
  } catch (e) {
    say(`[${k}] FAIL ${String(e.message).slice(0, 400)}`)
  }
}
say('done')
