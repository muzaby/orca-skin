// Run after npm run prebuild. Uses production renderer components, preload, IPC and workers.
import { build } from 'electron-vite'
import electron from 'electron'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = join(appRoot, 'node_modules', '.cache', 'orca')
const screenshots = join(cacheRoot, 'mail-archive-ui')
await mkdir(screenshots, { recursive: true })
const output = await mkdtemp(join(cacheRoot, 'mail-ui-'))
if (relative(cacheRoot, output).startsWith('..') || isAbsolute(relative(cacheRoot, output)))
  throw new Error('Unexpected UI test output directory')

try {
  const mutation = process.argv.includes('--remove-settings-slot')
  const configFile = join(output, 'config.mjs')
  const factoryUrl = pathToFileURL(
    join(appRoot, 'scripts/fixtures/mail-archive-ui-config.mjs')
  ).href
  await writeFile(
    configFile,
    `import { createMailUiConfig } from ${JSON.stringify(factoryUrl)};\nexport default createMailUiConfig(${JSON.stringify(appRoot)}, ${JSON.stringify(output)}, ${mutation});\n`
  )
  await build({ configFile, ignoreConfigWarning: true })
  const env = {
    ...process.env,
    ORCA_MAIL_UI_OUTPUT: output,
    ORCA_MAIL_UI_SCREENSHOTS: screenshots
  }
  delete env.ELECTRON_RUN_AS_NODE
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(electron, [join(output, 'main/mail-archive-ui-main.js')], {
      cwd: appRoot,
      env,
      stdio: 'inherit',
      windowsHide: true
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Mail archive UI timed out'))
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
  if (code !== 0) throw new Error(`Mail archive UI failed: ${code}`)
} finally {
  await rm(output, { recursive: true, force: true })
}
