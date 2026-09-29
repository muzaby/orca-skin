// Run after `npm run prebuild` (ensures the Electron SQLite ABI).
// This executes the production worker host, source worker, index worker and SQLite in Electron.
import { build } from 'electron-vite'
import electron from 'electron'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = join(appRoot, 'node_modules', '.cache', 'orca')
await mkdir(cacheRoot, { recursive: true })
const output = await mkdtemp(join(cacheRoot, 'mail-workers-'))
const relativeOutput = relative(cacheRoot, output)
if (relativeOutput.startsWith('..') || isAbsolute(relativeOutput))
  throw new Error('Unexpected test output directory')

try {
  const mutation = process.argv.includes('--drop-ack')
    ? `plugins: [{ name: 'drop-ack', enforce: 'pre', transform(code, id) {
        if (!id.replaceAll('\\\\', '/').endsWith('/batch-buffer.ts')) return;
        if (!code.includes('await acknowledgement')) throw new Error('ACK mutation target missing');
        return code.replace('await acknowledgement', 'void acknowledgement');
      }}],`
    : ''
  const configPath = join(output, 'config.mjs')
  await writeFile(
    configPath,
    `export default { main: { ${mutation} build: { outDir: ${JSON.stringify(join(output, 'out'))}, rollupOptions: { input: ${JSON.stringify(join(appRoot, 'scripts/fixtures/mail-archive-workers.ts'))} } } } }`
  )
  await build({ configFile: configPath, ignoreConfigWarning: true })
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(electron, [join(output, 'out/mail-archive-workers.js')], {
      cwd: appRoot,
      env,
      stdio: 'inherit',
      windowsHide: true
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Mail worker integration timed out'))
    }, 120_000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (exitCode) => {
      clearTimeout(timer)
      resolveExit(exitCode)
    })
  })
  if (code !== 0) throw new Error(`Mail worker integration failed: ${code}`)
} finally {
  await rm(output, { recursive: true, force: true })
}
