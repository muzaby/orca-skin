// 0326 AT-07 — transcript selection and copy in real Electron (D-102 · D-103 · D-107 · D-108).
// A verify-run tool, not a CI step (D-107). Performance is recorded, not judged (D-108).
//
// Builds `transcript-selection/probe.tsx` (production `TranscriptView` for each screen), serves it on
// 127.0.0.1 and drives it from `transcript-selection/electron-main.mjs` with real input events.
// The pure judge below re-computes the verdict from the raw records printed on stdout.
// Exit: 0 pass · 1 judged failure, harness error or failed Electron launch · 3 no Electron binary (`환경 없음`).
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SCREENS = ['claude-code', 'claude-work', 'opencode-code']
export const SCENARIOS = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4', 'C5']
export const RUNS = 3

const COPY = new Set(['A1', 'A2', 'A3', 'B1', 'B2', 'C4'])
const CANCEL = new Set(['B1', 'C1', 'C2', 'C3'])
const KEEP = new Set(['B2', 'C4', 'C5'])

/** Pasted text against the fixture expectation (start · markers in order · end · forbidden · lines). */
export function pasteMatches(pasted, expected) {
  if (typeof pasted !== 'string' || pasted.length === 0 || !expected) return false
  if (!pasted.startsWith(expected.start) || !pasted.endsWith(expected.end)) return false
  let at = expected.start.length
  for (const marker of expected.markers) {
    const found = pasted.indexOf(marker, at)
    if (found < 0) return false
    at = found + marker.length
  }
  if (expected.forbid.some((text) => pasted.includes(text))) return false
  return !expected.multi || pasted.split('\n').filter((line) => line.trim()).length >= 2
}

// `longTasks` and `cancelMs` stay in the raw records for diagnosis only (D-108).
function recordFailures(record) {
  const reasons = []
  if (record.error) return ['harness: ' + record.error]
  const texts = Array.isArray(record.selectionText) ? record.selectionText : []
  if (COPY.has(record.scenario)) {
    if (record.copyPrevented !== false) reasons.push('copy default prevented or not observed')
    if (!pasteMatches(record.pasted, record.expected)) reasons.push('pasted text')
  }
  if (CANCEL.has(record.scenario)) {
    if (!(record.mountedKeys >= 1)) reasons.push('no row mounted')
    // The selected rows must stay mounted, or Chromium itself drops the selection (ΔV2 rev 3).
    if (record.endsMounted !== true) reasons.push('selected rows unmounted')
    if (texts.length === 0 || texts.some((text) => text !== '')) reasons.push('selection survived')
    if (record.clipboard !== record.sentinel) reasons.push('clipboard changed after cancel')
  }
  if (KEEP.has(record.scenario)) {
    const mountsExpected = record.scenario === 'C5'
    if (mountsExpected ? !(record.mountedKeys >= 1) : record.mountedKeys !== 0)
      reasons.push(mountsExpected ? 'no row mounted' : 'control mounted a row')
    if (texts.length < 2 || !texts[0] || texts.some((text) => text !== texts[0]))
      reasons.push('selection changed')
  }
  return reasons
}

/** Fail-closed over the expected record grid. */
export function judgeSelectionRuns(records) {
  const failures = []
  const seen = new Set()
  for (const record of Array.isArray(records) ? records : []) {
    const id = `${record.screen}/${record.scenario}/${record.run}`
    if (!SCREENS.includes(record.screen) || !SCENARIOS.includes(record.scenario)) {
      failures.push({ ...pick(record), reason: 'unknown record' })
      continue
    }
    seen.add(id)
    for (const reason of recordFailures(record)) failures.push({ ...pick(record), reason })
  }
  for (const screen of SCREENS)
    for (const scenario of SCENARIOS)
      for (let run = 0; run < RUNS; run++)
        if (!seen.has(`${screen}/${scenario}/${run}`))
          failures.push({ screen, scenario, run, reason: 'missing record' })
  return { verdict: failures.length === 0, failures }
}

function pick({ screen, scenario, run }) {
  return { screen, scenario, run }
}

/** Electron exists but did not produce a result — a harness error, not a missing environment. */
export function launchFailure(error) {
  return { env: true, verdict: false, error: String(error) }
}

export function selectionExitCode({ env, error, verdict }) {
  if (!env) return 3
  if (error) return 1
  return verdict ? 0 : 1
}

function runElectron(binary, origin) {
  return new Promise((resolve, reject) => {
    const args = [
      fileURLToPath(new URL('./transcript-selection/electron-main.mjs', import.meta.url))
    ]
    // Root containers cannot use the setuid sandbox helper.
    if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox')
    const child = spawn(binary, [...args, origin, SCREENS.join(','), String(RUNS)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' }
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      const line = out.split('\n').find((l) => l.startsWith('OO_RESULT '))
      if (!line) reject(new Error(`electron exited ${code} without result: ${err.slice(-2000)}`))
      else resolve(JSON.parse(line.slice('OO_RESULT '.length)))
    })
  })
}

async function main() {
  let binary
  try {
    binary = createRequire(import.meta.url)('electron')
    if (typeof binary !== 'string') throw new Error('electron binary path unavailable')
  } catch (error) {
    return { env: false, verdict: false, reason: '환경 없음', error: String(error) }
  }
  let server
  let dist
  try {
    const { build, preview } = await import('vite')
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    const root = fileURLToPath(new URL('../', import.meta.url))
    dist = await mkdtemp(join(os.tmpdir(), 'oo-selection-'))
    const config = {
      root,
      configFile: false,
      logLevel: 'silent',
      build: {
        outDir: dist,
        target: 'esnext',
        rollupOptions: {
          input: join(root, 'scripts/transcript-selection/probe.tsx'),
          output: { entryFileNames: 'probe.js' }
        }
      }
    }
    await build({
      ...config,
      worker: { format: 'es' },
      esbuild: { jsx: 'automatic' },
      resolve: { alias: { '@renderer': join(root, 'src/renderer/src') } },
      plugins: [tailwindcss()]
    })
    await writeFile(
      join(dist, 'index.html'),
      '<!doctype html><meta charset="utf-8"><div id="root"></div><script type="module" src="/probe.js"></script>'
    )
    server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } })
    const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
    let output
    try {
      output = await runElectron(binary, origin)
    } catch (error) {
      return launchFailure(error)
    }
    if (output.error) return { env: true, verdict: false, ...output }
    return { env: true, ...output, ...judgeSelectionRuns(output.records) }
  } catch (error) {
    return { env: true, verdict: false, error: String(error) }
  } finally {
    if (server) await server.close()
    if (dist) await rm(dist, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await main()
  console.log(JSON.stringify(result))
  process.exitCode = selectionExitCode(result)
}
